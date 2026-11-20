import "dotenv/config";
import { defineConfig } from "drizzle-kit";

// Vercel + Neon: drizzle-kit precisa da conexão DIRETA (sem pooler/PgBouncer).
// A integração Neon expõe DATABASE_URL_UNPOOLED; localmente usa DATABASE_URL do .env.
const url =
  process.env.DATABASE_URL_UNPOOLED ||
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL;

if (!url) throw new Error("[drizzle] Defina DATABASE_URL_UNPOOLED ou DATABASE_URL.");

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  dbCredentials: { url },
  strict: false,
  verbose: false,
});
