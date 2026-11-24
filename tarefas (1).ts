// Camada de DADOS das tarefas: todo o SQL do sistema está aqui.
//
// Regras que valem para TODAS as consultas:
//  1. Valores vêm sempre por "?" (consulta parametrizada). Texto do usuário
//     nunca é concatenado ao SQL — por isso ' OR '1'='1 vira só um texto.
//  2. Toda consulta filtra por usuario_id: cada pessoa só alcança o que é seu.
import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { banco, comTransacao } from "../banco";
import type { Alteracao, Contagem, FiltroTarefas, NovaTarefa, Status, Tarefa } from "../tipos";

// O SELECT base. Uma subconsulta com JOIN junta os nomes das tags de cada
// tarefa numa linha só ("Trabalho,Urgente"); paraTarefa() devolve para array.
const SELECT_TAREFAS = `
  SELECT t.id, t.titulo, t.descricao, t.prioridade, t.status,
         DATE_FORMAT(t.prazo, '%Y-%m-%d') AS prazo,
         t.criada_em AS criadaEm,
         (SELECT GROUP_CONCAT(g.nome ORDER BY g.nome SEPARATOR ',')
            FROM tarefa_tag tt
            JOIN tags g ON g.id = tt.tag_id
           WHERE tt.tarefa_id = t.id) AS tags
    FROM tarefas t`;

// Linha do banco → Tarefa. NULL some do objeto (campos opcionais).
function paraTarefa(linha: RowDataPacket): Tarefa {
  return {
    id: linha.id,
    titulo: linha.titulo,
    ...(linha.descricao ? { descricao: String(linha.descricao) } : {}),
    prioridade: linha.prioridade,
    status: linha.status,
    ...(linha.prazo ? { prazo: String(linha.prazo) } : {}),
    criadaEm: linha.criadaEm instanceof Date ? linha.criadaEm.toISOString() : String(linha.criadaEm),
    tags: linha.tags ? String(linha.tags).split(",") : [],
  };
}

// No LIKE, % e _ são curingas: quem digitar "100%" procura "100%", não "100..."
function escaparCuringas(texto: string): string {
  return texto.replace(/[\\%_]/g, "\\$&");
}

// ---------- consultas ----------

export async function listar(usuarioId: number, filtro: FiltroTarefas): Promise<Tarefa[]> {
  let sql = `${SELECT_TAREFAS} WHERE t.usuario_id = ?`;
  const valores: (string | number)[] = [usuarioId];

  if (filtro.status) {
    sql += " AND t.status = ?"; // o filter, no banco
    valores.push(filtro.status);
  }
  if (filtro.busca) {
    // o includes, no banco: procura no título OU no nome de alguma tag
    sql += ` AND (t.titulo LIKE ?
                  OR EXISTS (SELECT 1
                               FROM tarefa_tag tt
                               JOIN tags g ON g.id = tt.tag_id
                              WHERE tt.tarefa_id = t.id AND g.nome LIKE ?))`;
    const padrao = `%${escaparCuringas(filtro.busca)}%`;
    valores.push(padrao, padrao);
  }
  if (filtro.atrasadas) {
    // só o banco sabe a data de hoje de forma confiável
    sql += " AND t.prazo < CURDATE() AND t.status <> 'concluida'";
  }
  sql += " ORDER BY FIELD(t.prioridade, 'alta', 'media', 'baixa'), t.titulo"; // o sort

  const [linhas] = await banco.execute<RowDataPacket[]>(sql, valores);
  return linhas.map(paraTarefa);
}

// 0 ou 1 linha. Tarefa de outro usuário = não existe para quem pergunta.
export async function buscarPorId(id: number, usuarioId: number): Promise<Tarefa | undefined> {
  const [linhas] = await banco.execute<RowDataPacket[]>(
    `${SELECT_TAREFAS} WHERE t.id = ? AND t.usuario_id = ?`,
    [id, usuarioId]
  );
  const linha = linhas[0];
  return linha ? paraTarefa(linha) : undefined;
}

// O painel: o GROUP BY faz o que o reduce faz no navegador.
export async function contarPorStatus(usuarioId: number): Promise<Contagem> {
  const [linhas] = await banco.execute<RowDataPacket[]>(
    `SELECT status, COUNT(*) AS quantidade
       FROM tarefas
      WHERE usuario_id = ?
      GROUP BY status`,
    [usuarioId]
  );
  // começa com zeros: o GROUP BY não devolve linha para status sem tarefa
  const contagem: Contagem = { pendente: 0, em_andamento: 0, concluida: 0 };
  for (const linha of linhas) {
    contagem[linha.status as Status] = Number(linha.quantidade);
  }
  return contagem;
}

// ---------- escrita ----------

// Grava as tags de uma tarefa. A tag é criada só se ainda não existir
// (UNIQUE usuario_id+nome); o truque LAST_INSERT_ID(id) faz o insertId valer
// também quando a tag já existia.
async function ligarTags(
  conexao: PoolConnection,
  usuarioId: number,
  tarefaId: number,
  tags: string[]
): Promise<void> {
  for (const nome of tags) {
    const [tag] = await conexao.execute<ResultSetHeader>(
      `INSERT INTO tags (usuario_id, nome) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)`,
      [usuarioId, nome]
    );
    await conexao.execute("INSERT IGNORE INTO tarefa_tag (tarefa_id, tag_id) VALUES (?, ?)", [
      tarefaId,
      tag.insertId,
    ]);
  }
}

export async function inserir(usuarioId: number, nova: NovaTarefa): Promise<number> {
  return comTransacao(async (conexao) => {
    const [resultado] = await conexao.execute<ResultSetHeader>(
      `INSERT INTO tarefas (usuario_id, titulo, descricao, prioridade, status, prazo)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [usuarioId, nova.titulo, nova.descricao ?? null, nova.prioridade, nova.status, nova.prazo ?? null]
    );
    await ligarTags(conexao, usuarioId, resultado.insertId, nova.tags);
    return resultado.insertId;
  });
}

export async function atualizar(id: number, usuarioId: number, alteracao: Alteracao): Promise<void> {
  // Os nomes das colunas abaixo são literais deste arquivo; o que o usuário
  // enviou entra só pelos "?" (valores).
  const colunas: string[] = [];
  const valores: (string | number | null)[] = [];
  const mudar = (coluna: string, valor: string | null): void => {
    colunas.push(`${coluna} = ?`);
    valores.push(valor);
  };
  if (alteracao.titulo !== undefined) mudar("titulo", alteracao.titulo);
  if (alteracao.descricao !== undefined) mudar("descricao", alteracao.descricao);
  if (alteracao.prioridade !== undefined) mudar("prioridade", alteracao.prioridade);
  if (alteracao.status !== undefined) mudar("status", alteracao.status);
  if (alteracao.prazo !== undefined) mudar("prazo", alteracao.prazo);

  await comTransacao(async (conexao) => {
    if (colunas.length > 0) {
      await conexao.execute(
        `UPDATE tarefas SET ${colunas.join(", ")} WHERE id = ? AND usuario_id = ?`,
        [...valores, id, usuarioId]
      );
    }
    if (alteracao.tags !== undefined) {
      // troca o conjunto de tags: apaga as ligações antigas e grava as novas
      await conexao.execute("DELETE FROM tarefa_tag WHERE tarefa_id = ?", [id]);
      await ligarTags(conexao, usuarioId, id, alteracao.tags);
    }
  });
}

// O "AND usuario_id = ?" é o que impede um usuário de apagar a tarefa de
// outro: com o id de outra pessoa, nenhuma linha atende ao WHERE.
export async function remover(id: number, usuarioId: number): Promise<void> {
  await banco.execute("DELETE FROM tarefas WHERE id = ? AND usuario_id = ?", [id, usuarioId]);
  // as ligações em tarefa_tag saem junto (ON DELETE CASCADE)
}
