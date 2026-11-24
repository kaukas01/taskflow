import * as dados from "../dados/tarefas";
import { ErroHttp } from "../erros";
import type { Contagem, Tarefa } from "../tipos";
import { validarAlteracao, validarFiltro, validarId, validarNovaTarefa } from "../validacao";

// 404 e não 403 para tarefa de outro usuário: quem não é dono nem fica
// sabendo que o id existe.
async function exigirTarefa(id: number, usuarioId: number): Promise<Tarefa> {
  const tarefa = await dados.buscarPorId(id, usuarioId);
  if (!tarefa) throw new ErroHttp(404, "Tarefa não encontrada.");
  return tarefa;
}

export function listar(usuarioId: number, query: unknown): Promise<Tarefa[]> {
  return dados.listar(usuarioId, validarFiltro(query));
}

export function obter(usuarioId: number, id: string): Promise<Tarefa> {
  return exigirTarefa(validarId(id), usuarioId);
}

export async function criar(usuarioId: number, corpo: unknown): Promise<Tarefa> {
  const nova = validarNovaTarefa(corpo);
  const id = await dados.inserir(usuarioId, nova);
  return exigirTarefa(id, usuarioId);
}

export async function alterar(usuarioId: number, idTexto: string, corpo: unknown): Promise<Tarefa> {
  const id = validarId(idTexto);
  const alteracao = validarAlteracao(corpo);
  await exigirTarefa(id, usuarioId); // 404 se não existir ou for de outro
  await dados.atualizar(id, usuarioId, alteracao);
  return exigirTarefa(id, usuarioId);
}

export async function remover(usuarioId: number, idTexto: string): Promise<void> {
  const id = validarId(idTexto);
  await exigirTarefa(id, usuarioId);
  await dados.remover(id, usuarioId);
}

export function estatisticas(usuarioId: number): Promise<Contagem> {
  return dados.contarPorStatus(usuarioId);
}
