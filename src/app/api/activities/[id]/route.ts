import { withJson } from "@/lib/api";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { activities } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSport } from "@/lib/sports";
import { analyzeActivity } from "@/lib/anticheat";

async function _PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const id = Number((await ctx.params).id);
  const b = await req.json();
  const set: Partial<typeof activities.$inferInsert> = {};
  if (typeof b.title === "string") set.title = b.title.slice(0, 120) || "Atividade";
  if (typeof b.caption === "string") set.caption = b.caption.slice(0, 2000);
  if (b.status === "published" || b.status === "draft") set.status = b.status;
  if (typeof b.sport === "string") {
    // trocar a modalidade reavalia a integridade (ex.: gravou como pedal e tenta mudar para corrida)
    const sp = getSport(b.sport);
    const [cur] = await db.select().from(activities).where(eq(activities.id, id));
    if (cur && cur.sport !== sp.key) {
      const check = analyzeActivity({ points: cur.points, group: sp.group, gps: sp.gps, distanceM: cur.distanceM, movingSec: cur.movingSec });
      if (cur.integrity === "suspect" && check.status === "valid") check.reasons = cur.integrityReasons; // não "limpa" atividade já marcada
      else { set.integrity = check.status; set.integrityReasons = check.reasons; }
    }
    set.sport = sp.key;
  }
  if (b.extra && typeof b.extra === "object") set.extra = b.extra;
  await db.update(activities).set(set).where(eq(activities.id, id));
  return NextResponse.json({ ok: true });
}

async function _DELETE(_: Request, ctx: { params: Promise<{ id: string }> }) {
  await db.delete(activities).where(eq(activities.id, Number((await ctx.params).id)));
  return NextResponse.json({ ok: true });
}

export const PATCH = withJson(_PATCH);
export const DELETE = withJson(_DELETE);
