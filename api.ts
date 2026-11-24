// Tudo que conversa com a API fica aqui. O resto da página não sabe de fetch.
import type { Alteracao, Contagem, FiltroBanco, NovaTarefa, Sessao, Tarefa, Usuario } from "./tipos";

const CHAVE_SESSAO = "taskflow:sessao";

// ---------- A sessão: o "crachá" guardado no navegador ----------
export function sessaoAtual(): Sessao | undefined {
  try {
    const texto = localStorage.getItem(CHAVE_SESSAO);
    return texto ? (JSON.parse(texto) as Sessao) : undefined;
  } catch {
    return undefined; // localStorage bloqueado ou conteúdo estragado
  }
}

export function guardarSessao(sessao: Sessao): void {
  localStorage.setItem(CHAVE_SESSAO, JSON.stringify(sessao));
}

export function encerrarSessao(): void {
  localStorage.removeItem(CHAVE_SESSAO);
}

// ---------- A ajudante: mostra o crachá em todo pedido e traduz os erros ----------
async function enviar(metodo: string, url: string, corpo?: unknown): Promise<Response> {
  const sessao = sessaoAtual();
  let resposta: Response;
  try {
    resposta = await fetch(url, {
      method: metodo,
      headers: {
        "Content-Type": "application/json",
        ...(sessao ? { Authorization: `Bearer ${sessao.token}` } : {}),
      },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    });
  } catch {
    // fetch só rejeita quando nem chegou ao servidor (rede caída, servidor desligado)
    throw new Error("Não foi possível falar com o servidor. Confira a conexão e tente de novo.");
  }

  // crachá vencido ou inválido: volta para a tela de entrada
  if (resposta.status === 401 && sessao) {
    encerrarSessao();
    location.reload();
  }
  if (!resposta.ok) {
    // a API manda { erro: "..." }; se não mandar, usamos o código
    const dados = (await resposta.json().catch(() => ({}))) as { erro?: string };
    // sem corpo da API e erro de servidor: o Vite não achou a API na porta 3000
    const semApi = resposta.status >= 500 && dados.erro === undefined;
    throw new Error(
      dados.erro ?? (semApi ? "A API não respondeu. Rode npm run dev na pasta api." : `Erro ${resposta.status}`)
    );
  }
  return resposta;
}

// ---------- Tarefas ----------
// Sem filtro: todas as tarefas de quem está logado. Com { atrasadas: true }
// o filtro roda no banco (WHERE prazo < CURDATE()).
export async function listarTarefas(filtro: FiltroBanco = {}): Promise<Tarefa[]> {
  const parametros = new URLSearchParams();
  if (filtro.atrasadas) parametros.set("atrasadas", "true");
  const texto = parametros.toString();
  const resposta = await enviar("GET", texto ? `/api/tarefas?${texto}` : "/api/tarefas");
  return (await resposta.json()) as Tarefa[];
}

export async function criarTarefa(nova: NovaTarefa): Promise<Tarefa> {
  const resposta = await enviar("POST", "/api/tarefas", nova);
  return (await resposta.json()) as Tarefa;
}

export async function atualizarTarefa(id: number, alteracao: Alteracao): Promise<Tarefa> {
  const resposta = await enviar("PATCH", `/api/tarefas/${id}`, alteracao);
  return (await resposta.json()) as Tarefa;
}

export async function removerTarefa(id: number): Promise<void> {
  await enviar("DELETE", `/api/tarefas/${id}`); // 204: sem corpo para ler
}

// O painel, calculado pelo banco com GROUP BY
export async function buscarEstatisticas(): Promise<Contagem> {
  const resposta = await enviar("GET", "/api/estatisticas");
  return (await resposta.json()) as Contagem;
}

// ---------- Usuários ----------
export async function entrar(email: string, senha: string): Promise<Sessao> {
  const resposta = await enviar("POST", "/api/login", { email, senha });
  return (await resposta.json()) as Sessao;
}

export async function criarConta(nome: string, email: string, senha: string): Promise<void> {
  await enviar("POST", "/api/usuarios", { nome, email, senha });
}

// Quem sou eu, segundo o servidor (confere o token e traz o nome atual)
export async function buscarEu(): Promise<Usuario> {
  const resposta = await enviar("GET", "/api/eu");
  return (await resposta.json()) as Usuario;
}
