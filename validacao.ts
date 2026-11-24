// Validação da entrada. Nada que vem do cliente entra no sistema sem passar
// por aqui: o corpo chega como "unknown" e sai como tipo conhecido — ou
// vira um 400 com mensagem clara.
import { ErroHttp } from "./erros";
import { PRIORIDADES, STATUS } from "./tipos";
import type { Alteracao, Cadastro, FiltroTarefas, NovaTarefa, Prioridade, Status } from "./tipos";

const MAX_TITULO = 120;
const MAX_DESCRICAO = 500;
const MAX_TAG = 30;
const MAX_TAGS = 5;
const MAX_BUSCA = 100;
const MAX_NOME = 100;
const MAX_EMAIL = 150;
const MIN_SENHA = 6;
const MAX_SENHA_BYTES = 72; // o bcrypt só considera os 72 primeiros bytes

function objeto(corpo: unknown): Record<string, unknown> {
  if (typeof corpo !== "object" || corpo === null || Array.isArray(corpo)) {
    throw new ErroHttp(400, "Envie os dados em formato JSON.");
  }
  return corpo as Record<string, unknown>;
}

// ---------- campos da tarefa ----------

function lerTitulo(valor: unknown): string {
  const titulo = typeof valor === "string" ? valor.trim() : "";
  if (titulo === "" || titulo.length > MAX_TITULO) {
    throw new ErroHttp(400, `O título é obrigatório (até ${MAX_TITULO} caracteres).`);
  }
  return titulo;
}

// Ausente, null ou vazio → null (vira NULL no banco).
function lerDescricao(valor: unknown): string | null {
  if (valor === undefined || valor === null) return null;
  if (typeof valor !== "string") throw new ErroHttp(400, "A descrição deve ser um texto.");
  const descricao = valor.trim();
  if (descricao.length > MAX_DESCRICAO) {
    throw new ErroHttp(400, `A descrição aceita até ${MAX_DESCRICAO} caracteres.`);
  }
  return descricao === "" ? null : descricao;
}

function lerPrioridade(valor: unknown): Prioridade {
  if (typeof valor === "string" && (PRIORIDADES as readonly string[]).includes(valor)) {
    return valor as Prioridade;
  }
  throw new ErroHttp(400, `Prioridade inválida. Use: ${PRIORIDADES.join(", ")}.`);
}

function lerStatus(valor: unknown): Status {
  if (typeof valor === "string" && (STATUS as readonly string[]).includes(valor)) {
    return valor as Status;
  }
  throw new ErroHttp(400, `Status inválido. Use: ${STATUS.join(", ")}.`);
}

// "AAAA-MM-DD" e uma data que existe de verdade (nada de 2026-02-31).
export function dataValida(texto: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) return false;
  const data = new Date(`${texto}T00:00:00Z`);
  return !Number.isNaN(data.getTime()) && data.toISOString().slice(0, 10) === texto;
}

function lerPrazo(valor: unknown): string | null {
  if (valor === undefined || valor === null || valor === "") return null;
  if (typeof valor !== "string" || !dataValida(valor)) {
    throw new ErroHttp(400, "Prazo inválido. Use uma data no formato AAAA-MM-DD.");
  }
  return valor;
}

function lerTags(valor: unknown): string[] {
  if (!Array.isArray(valor)) throw new ErroHttp(400, "As tags devem ser uma lista de textos.");
  const vistas = new Set<string>();
  const tags: string[] = [];
  for (const item of valor) {
    if (typeof item !== "string") throw new ErroHttp(400, "As tags devem ser textos.");
    const tag = item.trim();
    if (tag === "") continue;
    if (tag.length > MAX_TAG || tag.includes(",")) {
      throw new ErroHttp(400, `Cada tag tem até ${MAX_TAG} caracteres e não pode ter vírgula.`);
    }
    const chave = tag.toLowerCase(); // "Casa" e "casa" são a mesma tag
    if (!vistas.has(chave)) {
      vistas.add(chave);
      tags.push(tag);
    }
  }
  if (tags.length > MAX_TAGS) throw new ErroHttp(400, `Use no máximo ${MAX_TAGS} tags por tarefa.`);
  return tags;
}

// ---------- o que as rotas pedem ----------

export function validarNovaTarefa(corpo: unknown): NovaTarefa {
  const dados = objeto(corpo);
  const descricao = lerDescricao(dados.descricao);
  const prazo = lerPrazo(dados.prazo);
  return {
    titulo: lerTitulo(dados.titulo),
    ...(descricao !== null ? { descricao } : {}),
    prioridade: dados.prioridade === undefined ? "media" : lerPrioridade(dados.prioridade),
    status: dados.status === undefined ? "pendente" : lerStatus(dados.status),
    ...(prazo !== null ? { prazo } : {}),
    tags: dados.tags === undefined ? [] : lerTags(dados.tags),
  };
}

// No PATCH só valida (e devolve) o que veio: o resto fica como está.
export function validarAlteracao(corpo: unknown): Alteracao {
  const dados = objeto(corpo);
  const alteracao: Alteracao = {};
  if ("titulo" in dados) alteracao.titulo = lerTitulo(dados.titulo);
  if ("descricao" in dados) alteracao.descricao = lerDescricao(dados.descricao);
  if ("prioridade" in dados) alteracao.prioridade = lerPrioridade(dados.prioridade);
  if ("status" in dados) alteracao.status = lerStatus(dados.status);
  if ("prazo" in dados) alteracao.prazo = lerPrazo(dados.prazo);
  if ("tags" in dados) alteracao.tags = lerTags(dados.tags);
  if (Object.keys(alteracao).length === 0) {
    throw new ErroHttp(400, "Envie ao menos um campo para alterar.");
  }
  return alteracao;
}

export function validarId(texto: string): number {
  const id = Number(texto);
  if (!/^\d+$/.test(texto) || !Number.isSafeInteger(id) || id < 1) {
    throw new ErroHttp(400, "Identificador inválido.");
  }
  return id;
}

// /api/tarefas?status=pendente&busca=rev&atrasadas=true
export function validarFiltro(query: unknown): FiltroTarefas {
  const dados = typeof query === "object" && query !== null ? (query as Record<string, unknown>) : {};
  const filtro: FiltroTarefas = { atrasadas: false };

  if (dados.status !== undefined) filtro.status = lerStatus(dados.status);

  if (dados.busca !== undefined) {
    if (typeof dados.busca !== "string" || dados.busca.length > MAX_BUSCA) {
      throw new ErroHttp(400, `A busca aceita até ${MAX_BUSCA} caracteres.`);
    }
    const busca = dados.busca.trim();
    if (busca !== "") filtro.busca = busca;
  }

  if (dados.atrasadas !== undefined) {
    if (dados.atrasadas !== "true" && dados.atrasadas !== "false") {
      throw new ErroHttp(400, "O filtro atrasadas aceita true ou false.");
    }
    filtro.atrasadas = dados.atrasadas === "true";
  }
  return filtro;
}

// ---------- usuários ----------

const FORMATO_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validarCadastro(corpo: unknown): Cadastro {
  const dados = objeto(corpo);
  const nome = typeof dados.nome === "string" ? dados.nome.trim() : "";
  const email = typeof dados.email === "string" ? dados.email.trim().toLowerCase() : "";
  const senha = typeof dados.senha === "string" ? dados.senha : "";

  if (nome === "" || nome.length > MAX_NOME) {
    throw new ErroHttp(400, `Informe o nome (até ${MAX_NOME} caracteres).`);
  }
  if (!FORMATO_EMAIL.test(email) || email.length > MAX_EMAIL) {
    throw new ErroHttp(400, "Informe um e-mail válido.");
  }
  if (senha.length < MIN_SENHA || Buffer.byteLength(senha) > MAX_SENHA_BYTES) {
    throw new ErroHttp(400, `A senha deve ter de ${MIN_SENHA} a ${MAX_SENHA_BYTES} caracteres.`);
  }
  return { nome, email, senha };
}

export function validarLogin(corpo: unknown): { email: string; senha: string } {
  const dados = objeto(corpo);
  const email = typeof dados.email === "string" ? dados.email.trim().toLowerCase() : "";
  const senha = typeof dados.senha === "string" ? dados.senha : "";
  if (email === "" || senha === "") throw new ErroHttp(400, "Informe e-mail e senha.");
  return { email, senha };
}
