// Camada de DADOS: só conversa com o MySQL. Sem regra de negócio e sem HTTP.
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { banco } from "../banco";
import type { UsuarioPublico } from "../tipos";

export async function inserir(nome: string, email: string, senhaHash: string): Promise<number> {
  const [resultado] = await banco.execute<ResultSetHeader>(
    "INSERT INTO usuarios (nome, email, senha_hash) VALUES (?, ?, ?)",
    [nome, email, senhaHash]
  );
  return resultado.insertId;
}

export async function buscarParaLogin(
  email: string
): Promise<{ id: number; nome: string; senhaHash: string } | undefined> {
  const [linhas] = await banco.execute<RowDataPacket[]>(
    "SELECT id, nome, senha_hash FROM usuarios WHERE email = ?",
    [email]
  );
  const linha = linhas[0];
  return linha ? { id: linha.id, nome: linha.nome, senhaHash: linha.senha_hash } : undefined;
}

// Nunca seleciona senha_hash: este caminho devolve dados para a tela.
export async function buscarPorId(id: number): Promise<UsuarioPublico | undefined> {
  const [linhas] = await banco.execute<RowDataPacket[]>(
    "SELECT id, nome, email FROM usuarios WHERE id = ?",
    [id]
  );
  const linha = linhas[0];
  return linha ? { id: linha.id, nome: linha.nome, email: linha.email } : undefined;
}
