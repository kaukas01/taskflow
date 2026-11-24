// Erro "esperado": a regra de negócio recusou e já sabe o código HTTP certo.
// Os serviços lançam; o tratador de erros do servidor converte em resposta.
export class ErroHttp extends Error {
  readonly status: number;

  constructor(status: number, mensagem: string) {
    super(mensagem);
    this.status = status;
  }
}

// Código de erro do mysql2/Node ("ER_DUP_ENTRY", "ECONNREFUSED"...).
// Em conexões que tentam IPv4 e IPv6 o erro vem embrulhado em "errors".
export function codigoDe(erro: unknown): string | undefined {
  if (typeof erro !== "object" || erro === null) return undefined;
  const direto = (erro as { code?: unknown }).code;
  if (typeof direto === "string") return direto;
  const internos = (erro as { errors?: unknown }).errors;
  if (Array.isArray(internos)) {
    return internos.map(codigoDe).find((codigo) => codigo !== undefined);
  }
  return undefined;
}

// Falhas em que o banco está fora do ar ou inacessível (não é culpa do usuário).
const CODIGOS_BANCO_FORA = new Set([
  "ECONNREFUSED",
  "ETIMEDOUT",
  "ENOTFOUND",
  "EAI_AGAIN",
  "PROTOCOL_CONNECTION_LOST",
  "ER_CON_COUNT_ERROR",
  "ER_ACCESS_DENIED_ERROR",
  "ER_BAD_DB_ERROR",
]);

export function bancoIndisponivel(erro: unknown): boolean {
  const codigo = codigoDe(erro);
  return codigo !== undefined && CODIGOS_BANCO_FORA.has(codigo);
}
