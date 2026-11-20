import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { activities, activityPhotos } from "@/db/schema";
import { requireApiUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_BYTES = 4_500_000;

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

  const body = (await request.json().catch(() => null)) as { photos?: { dataUrl?: string; caption?: string }[] } | null;
  const photos = (body?.photos ?? []).filter((p) => typeof p?.dataUrl === "string").slice(0, 12);
  if (photos.length === 0) return Response.json({ ok: false, error: "Nenhuma foto enviada" }, { status: 400 });

  const [{ next }] = await db
    .select({ next: sql<number>`coalesce(max(${activityPhotos.position}), -1) + 1` })
    .from(activityPhotos)
    .where(eq(activityPhotos.activityId, id));

  const inserted: number[] = [];
  let position = Number(next);
  for (const photo of photos) {
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
