// Camada de SERVIÇOS: as regras do sistema. Valida, decide, chama a camada
// de dados e lança ErroHttp com o código certo. Não conhece req nem res.
import bcrypt from "bcryptjs";
import { gerarToken } from "../autenticacao";
import * as dados from "../dados/usuarios";
import { codigoDe, ErroHttp } from "../erros";
import type { UsuarioPublico } from "../tipos";
import { validarCadastro, validarLogin } from "../validacao";

const CUSTO_BCRYPT = 10; // lento de propósito: encarece a adivinhação de senhas

// Hash válido de uma senha qualquer. Serve só para o bcrypt gastar o mesmo
// tempo quando o e-mail não existe (não revelar, pela demora, quem tem conta).
const HASH_FALSO = "$2b$10$mDxl2ubcI7O/KrG/h4H0n.Pok4jKJZfmh4ROQPSiWszf340mDT9e.";

export async function cadastrar(corpo: unknown): Promise<{ id: number }> {
  const { nome, email, senha } = validarCadastro(corpo);
  const hash = await bcrypt.hash(senha, CUSTO_BCRYPT); // a senha nunca vai para o banco
  try {
    return { id: await dados.inserir(nome, email, hash) };
  } catch (erro) {
    // quem descobre o e-mail repetido é o UNIQUE do banco; aqui só traduzimos
    if (codigoDe(erro) === "ER_DUP_ENTRY") {
      throw new ErroHttp(409, "Este e-mail já está cadastrado.");
    }
    throw erro;
  }
}

export async function entrar(corpo: unknown): Promise<{ token: string; nome: string }> {
  const { email, senha } = validarLogin(corpo);
  const usuario = await dados.buscarParaLogin(email);
  const confere = await bcrypt.compare(senha, usuario?.senhaHash ?? HASH_FALSO);
  if (!usuario || !confere) {
    // a mesma mensagem nos dois casos: não contamos qual dos dois errou
    throw new ErroHttp(401, "E-mail ou senha inválidos.");
  }
  return { token: gerarToken(usuario.id), nome: usuario.nome };
}

export async function perfil(usuarioId: number): Promise<UsuarioPublico> {
  const usuario = await dados.buscarPorId(usuarioId);
  if (!usuario) throw new ErroHttp(401, "Sua sessão expirou. Entre de novo.");
  return usuario;
}
