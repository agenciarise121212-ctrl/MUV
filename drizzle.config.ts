import "dotenv/config";
import { defineConfig } from "drizzle-kit";

/**
 * Configuração do Drizzle Kit.
 *
 * Substitui o antigo `drizzle.config.json`, que tinha a URL fixa de um Postgres
 * local (127.0.0.1:5432) e por isso quebrava o build na Vercel — o `push` não
 * conseguia abrir conexão nenhuma e o deploy morria em
 * "Pulling schema from database...".
 *
 * Resolução da URL, em ordem de prioridade:
 *   1. DATABASE_URL_UNPOOLED — string *direta* da Neon, sem PgBouncer. É a
 *      correta para executar DDL (`drizzle-kit push`), porque o pooler em modo
 *      transacional não suporta de forma confiável introspecção + DDL.
 *   2. DATABASE_URL — string que a integração Neon/Vercel define como *pooled*.
 *      Se ela terminar em `-pooler.`, derivamos o host direto (Neon usa
 *      `ep-xxxx-pooler.regiao.aws.neon.tech` → `ep-xxxx.regiao.aws.neon.tech`).
 *   3. Fallback do `.env` local, carregado por `dotenv/config`. O dotenv não
 *      sobrescreve variáveis já presentes no ambiente, então na Vercel os
 *      valores da integração sempre ganham.
 */

function resolveDatabaseUrl(): { url: string; source: string; direct: boolean } {
  const unpooled = process.env.DATABASE_URL_UNPOOLED?.trim();
  if (unpooled) {
    return { url: unpooled, source: "DATABASE_URL_UNPOOLED", direct: true };
  }

  const pooled = process.env.DATABASE_URL?.trim();
  if (!pooled) {
    return { url: "", source: "não definida", direct: false };
  }

  // Deriva o host direto quando só temos a string pooled da Neon.
  if (/-pooler\./.test(pooled)) {
    const derived = pooled.replace(/-pooler\./, ".");
    return { url: derived, source: "DATABASE_URL (host direto derivado)", direct: true };
  }

  return { url: pooled, source: "DATABASE_URL", direct: !/-pooler\./.test(pooled) };
}

const resolved = resolveDatabaseUrl();

if (!resolved.url) {
  throw new Error(
    "Nenhuma string de conexão encontrada. Defina DATABASE_URL_UNPOOLED (recomendado para DDL) ou DATABASE_URL.",
  );
}

// Diagnóstico curto no log de build: mostra o host e se é conexão direta.
// Nunca imprime a URL completa (evita vazar credenciais nos logs).
try {
  const parsed = new URL(resolved.url);
  console.log(
    `[drizzle] schema sync → ${parsed.host}${parsed.pathname} (fonte: ${resolved.source})`,
  );
} catch {
  console.log(`[drizzle] schema sync → fonte: ${resolved.source}`);
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: resolved.url,
  },
  // `push` com introspecção precisa ver o schema como está no banco.
  verbose: true,
  strict: false,
});
