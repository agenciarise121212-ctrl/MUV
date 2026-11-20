import { withJson } from "@/lib/api";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { activityPhotos } from "@/db/schema";
import { and, eq, max, sql } from "drizzle-orm";
import { MAX_PHOTOS } from "@/lib/image";

async function _POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const activityId = Number((await ctx.params).id);
  const { data, lat, lng, kmMark, takenAt } = await req.json();
  if (typeof data !== "string" || !/^data:image\/(webp|jpeg|png);base64,/.test(data) || data.length > 900_000)
    return NextResponse.json({ error: "Imagem inválida ou grande demais (máx. ~600 KB)." }, { status: 400 });
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(activityPhotos).where(eq(activityPhotos.activityId, activityId));
  if (n >= MAX_PHOTOS) return NextResponse.json({ error: `Limite de ${MAX_PHOTOS} fotos por atividade.` }, { status: 400 });
  const num = (v: unknown) => (typeof v === "number" && isFinite(v) ? v : null);
  const la = num(lat), ln = num(lng);
  const geo = la != null && ln != null && Math.abs(la) <= 90 && Math.abs(ln) <= 180 ? { lat: la, lng: ln } : { lat: null, lng: null };
  const t = typeof takenAt === "string" || typeof takenAt === "number" ? new Date(takenAt) : null;
  const [m] = await db.select({ m: max(activityPhotos.position) }).from(activityPhotos).where(eq(activityPhotos.activityId, activityId));
  const [row] = await db.insert(activityPhotos).values({ activityId, data, position: (m?.m ?? -1) + 1, ...geo, kmMark: num(kmMark), takenAt: t && !isNaN(t.getTime()) ? t : null }).returning({ id: activityPhotos.id });
  return NextResponse.json(row);
}

// Reordenar: { ids: number[] }
async function _PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const activityId = Number((await ctx.params).id);
  const { ids } = await req.json();
  if (!Array.isArray(ids)) return NextResponse.json({ error: "ids" }, { status: 400 });
  for (let i = 0; i < ids.length; i++)
    await db.update(activityPhotos).set({ position: i }).where(and(eq(activityPhotos.id, Number(ids[i])), eq(activityPhotos.activityId, activityId)));
  return NextResponse.json({ ok: true });
}

export const POST = withJson(_POST);
export const PUT = withJson(_PUT);
