import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { config } from "./config";

// O crachá: um token assinado com o segredo do .env, válido por 8 horas.
export function gerarToken(usuarioId: number): string {
  return jwt.sign({ id: usuarioId }, config.segredoJwt, { expiresIn: "8h" });
}

// Middleware (o "porteiro"): roda antes da rota. Se o crachá for válido,
// guarda o id do dono em res.locals e chama next(); se não, responde 401 e
// a rota nem chega a rodar.
export function exigirLogin(req: Request, res: Response, next: NextFunction): void {
  const cabecalho = req.headers.authorization;
  const token = cabecalho?.startsWith("Bearer ") ? cabecalho.slice(7) : undefined;
  if (!token) {
    res.status(401).json({ erro: "Faça login para continuar." });
    return;
  }
  try {
    const dados = jwt.verify(token, config.segredoJwt);
    if (typeof dados !== "object" || typeof dados.id !== "number") {
      throw new Error("token sem id");
    }
    res.locals.usuarioId = dados.id;
    next();
  } catch {
    res.status(401).json({ erro: "Sua sessão expirou. Entre de novo." });
  }
}

// Quem está logado nesta requisição. O id vem SEMPRE do token (assinado),
// nunca de um campo mandado pela página.
export function usuarioDe(res: Response): number {
  return res.locals.usuarioId as number;
}
