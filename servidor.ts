import { config } from "./config"; // primeiro: carrega o .env antes de tudo
import express from "express";
import type { NextFunction, Request, Response } from "express";
import { banco } from "./banco";
import { bancoIndisponivel, codigoDe, ErroHttp } from "./erros";
import { rotasEstatisticas } from "./rotas/estatisticas";
import { rotasTarefas } from "./rotas/tarefas";
import { rotasUsuarios } from "./rotas/usuarios";

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "10kb" }));

// Saúde: confere se a API e o banco estão de pé (bom para a demonstração).
app.get("/api/saude", async (_req, res) => {
  await banco.query("SELECT 1");
  res.json({ api: "ok", banco: "ok" });
});

app.use("/api", rotasUsuarios); // POST /usuarios, POST /login, GET /eu
app.use("/api/tarefas", rotasTarefas); // CRUD das tarefas (exige login)
app.use("/api/estatisticas", rotasEstatisticas); // o painel (exige login)

app.use("/api", (_req, res) => {
  res.status(404).json({ erro: "Rota não encontrada." });
});

// ---------- Tratamento de erros: um lugar só, com o código HTTP certo ----------
// O Express 5 manda aqui tanto os erros lançados quanto as promessas
// rejeitadas das rotas async.
function tratarErros(erro: unknown, _req: Request, res: Response, _proximo: NextFunction): void {
  // 1) recusa prevista pelas regras (400, 401, 404, 409...)
  if (erro instanceof ErroHttp) {
    res.status(erro.status).json({ erro: erro.message });
    return;
  }
  // 2) corpo do pedido que não é JSON, ou grande demais
  const tipo = (erro as { type?: unknown } | null)?.type;
  if (tipo === "entity.parse.failed") {
    res.status(400).json({ erro: "O corpo do pedido não é um JSON válido." });
    return;
  }
  if (tipo === "entity.too.large") {
    res.status(413).json({ erro: "O pedido é grande demais." });
    return;
  }
  // 3) token de um usuário que já não existe (a chave estrangeira recusou)
  if (codigoDe(erro) === "ER_NO_REFERENCED_ROW_2") {
    res.status(401).json({ erro: "Sua sessão expirou. Entre de novo." });
    return;
  }
  // 4) banco fora do ar: a tela mostra esta mensagem, não um erro técnico
  console.error(erro);
  if (bancoIndisponivel(erro)) {
    res.status(503).json({
      erro: "O banco de dados está indisponível no momento. Tente novamente em instantes.",
    });
    return;
  }
  // 5) qualquer outra coisa: 500 sem vazar detalhes internos
  res.status(500).json({ erro: "Erro interno do servidor." });
}
app.use(tratarErros);

app.listen(config.porta, () => {
  console.log(`API do TaskFlow em http://localhost:${config.porta}`);
  banco
    .query("SELECT 1")
    .then(() => console.log("Conexão com o MySQL: ok"))
    .catch((erro: unknown) => {
      console.error(`Não consegui conectar ao MySQL (${codigoDe(erro) ?? "erro"}). Confira o api/.env.`);
    });
});
