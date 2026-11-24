import { Router } from "express";
import { exigirLogin, usuarioDe } from "../autenticacao";
import { estatisticas } from "../servicos/tarefas";

export const rotasEstatisticas = Router();

// O painel: o GROUP BY do banco conta as tarefas de quem está logado.
rotasEstatisticas.get("/", exigirLogin, async (_req, res) => {
  res.json(await estatisticas(usuarioDe(res)));
});
