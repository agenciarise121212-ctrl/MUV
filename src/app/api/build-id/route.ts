import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

export const dynamic = "force-dynamic";

/**
 * Identificador da build atual.
 *
 * Usado pelo simulador (/preview) para recarregar o iframe automaticamente
 * quando uma nova versão é publicada. Combina duas fontes:
 *  - `.next/BUILD_ID` (estável dentro de um mesmo deploy)
 *  - horário de início do processo (muda quando o servidor reinicia, que é o
 *    sinal de novo build nos ambientes de preview)
 *
 * Nunca lança: se algo falhar, devolve um valor constante para o simulador
 * continuar funcionando sem recargas falsas.
 */

let bootTime = Date.now();

export async function GET() {
  let buildId: string | null = null;
  try {
    buildId = (await readFile(path.join(process.cwd(), ".next", "BUILD_ID"), "utf8")).trim();
  } catch {
    buildId = null;
  }

  const id = `${buildId ?? "no-build-id"}:${Math.floor(bootTime / 1000)}`;

  return Response.json(
    { id, buildId, at: new Date().toISOString() },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
