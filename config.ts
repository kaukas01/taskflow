// Lê o arquivo .env UMA vez, antes de qualquer outro módulo usar as variáveis.
// Quem precisa de configuração importa daqui — nunca lê process.env direto.
import "dotenv/config";

function exigir(nome: string): string {
  const valor = process.env[nome];
  if (!valor) {
    throw new Error(`Falta a variável ${nome} no arquivo api/.env (copie o .env.exemplo).`);
  }
  return valor;
}

export const config = {
  porta: Number(process.env.PORTA ?? 3000),
  segredoJwt: exigir("JWT_SEGREDO"),
  banco: {
    host: process.env.DB_HOST ?? "127.0.0.1",
    port: Number(process.env.DB_PORTA ?? 3306),
    user: process.env.DB_USUARIO ?? "root",
    password: process.env.DB_SENHA ?? "",
    database: process.env.DB_NOME ?? "taskflow",
  },
} as const;
