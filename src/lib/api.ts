import { NextResponse } from "next/server";

// Garante resposta JSON válida mesmo quando a rota lança erro (ex.: tabela ausente no banco).
type Handler<C> = (req: Request, ctx: C) => Promise<Response> | Response;
export function withJson<C>(fn: Handler<C>): Handler<C> {
  return async (req, ctx) => {
    try { return await fn(req, ctx); }
    catch (e) {
      if (e instanceof SyntaxError) return NextResponse.json({ error: "Dados enviados inválidos. Atualize a página e tente novamente." }, { status: 400 });
      const raw = e instanceof Error ? e.message : String(e);
      console.error("[api]", req.method, new URL(req.url).pathname, raw);
      const dbMissing = /relation .* does not exist|no such table|DATABASE_URL|ECONNREFUSED|ENOTFOUND|password authentication/i.test(raw);
      return NextResponse.json({ error: dbMissing ? "Banco de dados indisponível ou não inicializado. Tente novamente em instantes." : "Erro interno no servidor. Tente novamente." }, { status: 500 });
    }
  };
}
