#!/usr/bin/env node
/**
 * Sincronização do schema antes do build do Next.
 *
 * Na Vercel o build roda `node scripts/db-sync.mjs && next build`. Este passo
 * cria/atualiza as tabelas no Neon antes de qualquer página ser compilada,
 * o que elimina o erro de cadastro em banco recém-criado.
 *
 * Por que um script em vez de `drizzle-kit push --force` direto?
 *  - Log diagnóstico claro (qual host, conexão direta ou pooled).
 *  - Mensagem de erro explicativa em vez de um stack trace de driver.
 *
 * A URL usada é resolvida em `drizzle.config.ts` (DATABASE_URL_UNPOOLED
 * primeiro), então este script não precisa duplicar a lógica.
 */

import "dotenv/config";
import { spawnSync } from "node:child_process";
import process from "node:process";

// Sem este import, o guarda abaixo não enxerga o .env local e o push era
// pulado em desenvolvimento (a config do Drizzle carregava o dotenv, mas este
// script não — e a checagem roda antes do spawn).
const args = ["drizzle-kit", "push", "--force"];

function detectNeonPooled() {
  const unpooled = process.env.DATABASE_URL_UNPOOLED?.trim();
  if (unpooled) return { pooled: false, hasUnpooled: true };
  const url = process.env.DATABASE_URL?.trim() ?? "";
  return { pooled: /-pooler\./.test(url), hasUnpooled: false };
}

const { pooled, hasUnpooled } = detectNeonPooled();

if (pooled && !hasUnpooled) {
  console.warn(
    "[db-sync] ATENÇÃO: DATABASE_URL_UNPOOLED não definida e DATABASE_URL aponta para o pooler da Neon.\n" +
      "[db-sync] O `drizzle-kit push` executa DDL e funciona de forma mais confiável na conexão DIRETA.\n" +
      "[db-sync] A config do Drizzle deriva o host direto automaticamente, mas defina DATABASE_URL_UNPOOLED nas variáveis da Vercel para eliminar a ambiguidade.",
  );
}

if (!process.env.DATABASE_URL_UNPOOLED && !process.env.DATABASE_URL) {
  console.warn(
    "[db-sync] Nenhuma string de conexão encontrada neste ambiente.\n" +
      "[db-sync] Pulando a sincronização do schema — o build do Next continua, mas as tabelas não serão criadas aqui.",
  );
  process.exit(0);
}

console.log(`[db-sync] Executando: ${args.join(" ")}`);

const result = spawnSync("npx", args, {
  stdio: "inherit",
  shell: process.platform === "win32",
  env: process.env,
});

if (result.status !== 0) {
  console.error(
    "\n[db-sync] FALHA ao sincronizar o schema com o banco.\n" +
      "[db-sync] Causas mais comuns:\n" +
      "[db-sync]  1. DATABASE_URL apontando para o pooler da Neon — defina DATABASE_URL_UNPOOLED nas variáveis da Vercel.\n" +
      "[db-sync]  2. Banco pausado (Neon suspende free tier) — aguarde alguns segundos e rode o deploy novamente.\n" +
      "[db-sync]  3. Credenciais incorretas ou banco inexistente.\n" +
      "[db-sync] O build foi interrompido porque a aplicação não funcionaria sem as tabelas.",
  );
  process.exit(result.status ?? 1);
}

console.log("[db-sync] Schema sincronizado com sucesso.");
