import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { activities, activityPhotos } from "@/db/schema";
import { requireApiUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_BYTES = 4_500_000;
/** Limite de fotos por atividade (contador discreto `n/5` na interface). */
const MAX_PHOTOS = 5;

function decodeDataUrl(dataUrl: string): { buffer: Buffer; mime: string } | null {
  const match = /^data:(image\/(?:jpeg|jpg|png|webp));base64,(.+)$/.exec(dataUrl.trim());
  if (!match) return null;
  const buffer = Buffer.from(match[2], "base64");
  if (!buffer.length || buffer.length > MAX_BYTES) return null;
  return { buffer, mime: match[1] === "image/jpg" ? "image/jpeg" : match[1] };
}

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireApiUser();
  if (!user) return Response.json({ ok: false, error: "Não autenticado" }, { status: 401 });
  const { id: rawId } = await ctx.params;
  const id = Number(rawId);
  const owned = await db
    .select({ id: activities.id })
    .from(activities)
    .where(and(eq(activities.id, id), eq(activities.userId, user.id)))
    .limit(1);
  if (owned.length === 0) return Response.json({ ok: false, error: "Atividade não encontrada" }, { status: 404 });

  const body = (await request.json().catch(() => null)) as
    | { photos?: { dataUrl?: string; caption?: string; lat?: number; lng?: number; kmMark?: number; altitudeM?: number | null; elapsedAtMs?: number; checkinQuestId?: number }[] }
    | null;
  const photos = (body?.photos ?? []).filter((p) => typeof p?.dataUrl === "string").slice(0, MAX_PHOTOS);
  if (photos.length === 0) return Response.json({ ok: false, error: "Nenhuma foto enviada" }, { status: 400 });

  const [{ next, existing }] = await db
    .select({
      next: sql<number>`coalesce(max(${activityPhotos.position}), -1) + 1`,
      existing: sql<number>`count(*)::int`,
    })
    .from(activityPhotos)
    .where(eq(activityPhotos.activityId, id));
  const remaining = Math.max(0, MAX_PHOTOS - Number(existing));
  if (remaining === 0) {
    return Response.json({ ok: false, error: "Limite de 5 fotos por atividade atingido." }, { status: 400 });
  }

  const inserted: number[] = [];
  let position = Number(next);
  for (const photo of photos.slice(0, remaining)) {
    const decoded = decodeDataUrl(photo.dataUrl ?? "");
    if (!decoded) continue;
    const [row] = await db
      .insert(activityPhotos)
      .values({
        activityId: id,
        userId: user.id,
        data: decoded.buffer,
        mimeType: decoded.mime,
        caption: (photo.caption ?? "").slice(0, 190) || null,
        position,
        // Geolocalização do instante da foto — crava a imagem no trajeto.
        latitude: Number.isFinite(Number(photo.lat)) ? Number(photo.lat) : null,
        longitude: Number.isFinite(Number(photo.lng)) ? Number(photo.lng) : null,
        kmMark: Number.isFinite(Number(photo.kmMark)) ? Number(photo.kmMark) : null,
        altitudeM: Number.isFinite(Number(photo.altitudeM)) ? Number(photo.altitudeM) : null,
        elapsedAtMs: Number.isFinite(Number(photo.elapsedAtMs)) ? Math.max(0, Math.round(Number(photo.elapsedAtMs))) : null,
        checkinQuestId: Number.isInteger(photo.checkinQuestId) ? Number(photo.checkinQuestId) : null,
      })
      .returning({ id: activityPhotos.id });
    inserted.push(row.id);
    position += 1;
  }

  return Response.json({ ok: true, ids: inserted, added: inserted.length });
}

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireApiUser();
  if (!user) return Response.json({ ok: false, error: "Não autenticado" }, { status: 401 });
  const { id: rawId } = await ctx.params;
  const id = Number(rawId);
  const body = (await request.json().catch(() => null)) as
    | { order?: { id: number; position: number; caption?: string }[] }
    | null;
  const order = body?.order ?? [];
  if (order.length === 0) return Response.json({ ok: true });

  const owned = await db.select({ id: activityPhotos.id }).from(activityPhotos).where(eq(activityPhotos.activityId, id));
  const ownedIds = new Set(owned.map((o) => o.id));
  for (const item of order) {
    if (!ownedIds.has(item.id)) continue;
    await db
      .update(activityPhotos)
      .set({ position: item.position, caption: item.caption !== undefined ? item.caption.slice(0, 190) || null : undefined })
      .where(and(eq(activityPhotos.id, item.id), eq(activityPhotos.userId, user.id)));
  }
  return Response.json({ ok: true });
}

export async function DELETE(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireApiUser();
  if (!user) return Response.json({ ok: false, error: "Não autenticado" }, { status: 401 });
  const { id: rawId } = await ctx.params;
  const id = Number(rawId);
  const body = (await request.json().catch(() => null)) as { photoId?: number } | null;
  if (!body?.photoId) return Response.json({ ok: false, error: "Foto inválida" }, { status: 400 });
  await db.delete(activityPhotos).where(and(eq(activityPhotos.id, body.photoId), eq(activityPhotos.userId, user.id)));
  return Response.json({ ok: true });
}
