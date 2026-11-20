// Sincroniza o schema do Drizzle antes do build (Vercel + Neon). Usa drizzle.config.ts.
import { spawnSync } from "node:child_process";
import "dotenv/config";

const direct = process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL_NON_POOLING;
const url = direct || process.env.DATABASE_URL || process.env.POSTGRES_URL;
const onVercel = !!process.env.VERCEL;

if (!url) {
  const msg = "[db-push] Nenhuma URL de banco definida (DATABASE_URL_UNPOOLED / DATABASE_URL).";
  if (onVercel) { console.error(msg + " Configure-a nas variáveis de ambiente da Vercel."); process.exit(1); }
  console.warn(msg + " Sincronização ignorada."); process.exit(0);
}
const host = (() => { try { return new URL(url).host; } catch { return "?"; } })();
console.log(`[db-push] Sincronizando schema (${direct ? "conexão direta" : "conexão padrão"} · ${host})…`);
if (onVercel && !direct && /-pooler\./.test(url)) console.warn("[db-push] Aviso: usando conexão pooled da Neon. Prefira definir DATABASE_URL_UNPOOLED.");

const r = spawnSync("npx", ["drizzle-kit", "push", "--force", "--config=drizzle.config.ts"], { stdio: "inherit", env: process.env, shell: process.platform === "win32" });
if (r.status !== 0) {
  console.error("[db-push] Falha ao sincronizar o schema. Verifique a URL do banco e se o Neon está acessível.");
  process.exit(onVercel ? 1 : 0);
}
console.log("[db-push] Schema sincronizado.");
