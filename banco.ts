import mysql from "mysql2/promise";
import type { PoolConnection } from "mysql2/promise";
import { config } from "./config";

// Um pool: várias conexões reaproveitadas, em vez de abrir uma por pedido.
export const banco = mysql.createPool({
  ...config.banco,
  waitForConnections: true,
  connectionLimit: 10,
});

// Tudo ou nada: se qualquer passo falhar, o rollback desfaz os anteriores.
// Usado quando uma operação grava em mais de uma tabela (tarefa + tags).
export async function comTransacao<T>(
  trabalho: (conexao: PoolConnection) => Promise<T>
): Promise<T> {
  const conexao = await banco.getConnection();
  try {
    await conexao.beginTransaction();
    const resultado = await trabalho(conexao);
    await conexao.commit();
    return resultado;
  } catch (erro) {
    await conexao.rollback();
    throw erro;
  } finally {
    conexao.release();
  }
}
