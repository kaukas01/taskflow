// Camada de ROTAS: só HTTP. Lê o pedido, chama o serviço, escolhe o código.
// Erros (lançados pelo serviço ou pelo banco) caem no tratador do servidor.
import { Router } from "express";
import { exigirLogin, usuarioDe } from "../autenticacao";
import { cadastrar, entrar, perfil } from "../servicos/usuarios";

export const rotasUsuarios = Router();

rotasUsuarios.post("/usuarios", async (req, res) => {
  res.status(201).json(await cadastrar(req.body));
});

rotasUsuarios.post("/login", async (req, res) => {
  res.json(await entrar(req.body));
});

// Quem sou eu? Protegida; devolve id, nome e e-mail — nunca o senha_hash.
rotasUsuarios.get("/eu", exigirLogin, async (_req, res) => {
  res.json(await perfil(usuarioDe(res)));
});
