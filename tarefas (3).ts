import { Router } from "express";
import { exigirLogin, usuarioDe } from "../autenticacao";
import { alterar, criar, listar, obter, remover } from "../servicos/tarefas";

export const rotasTarefas = Router();

// O porteiro vale para TODAS as rotas deste arquivo.
rotasTarefas.use(exigirLogin);

// /api/tarefas?status=pendente&busca=rev&atrasadas=true
rotasTarefas.get("/", async (req, res) => {
  res.json(await listar(usuarioDe(res), req.query));
});

rotasTarefas.get("/:id", async (req, res) => {
  res.json(await obter(usuarioDe(res), req.params.id));
});

rotasTarefas.post("/", async (req, res) => {
  res.status(201).json(await criar(usuarioDe(res), req.body));
});

rotasTarefas.patch("/:id", async (req, res) => {
  res.json(await alterar(usuarioDe(res), req.params.id, req.body));
});

rotasTarefas.delete("/:id", async (req, res) => {
  await remover(usuarioDe(res), req.params.id);
  res.status(204).end();
});
