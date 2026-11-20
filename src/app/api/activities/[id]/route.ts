import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { activities, activityPhotos } from "@/db/schema";
import { requireApiUser } from "@/lib/auth";
import { processActivity } from "@/lib/gamification";
import { creditActivityToQuests } from "@/lib/quests";
import { getSport } from "@/lib/sports";

export const dynamic = "force-dynamic";

type Patch = {
  name?: string;
  notes?: string | null;
  location?: string | null;
  visibility?: string;
  distanceM?: number;
  commute?: boolean;
  isIndoor?: boolean;
  weather?: string | null;
  publish?: boolean;
};

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireApiUser();
  if (!user) return Response.json({ ok: false, error: "Não autenticado" }, { status: 401 });
  const { id: rawId } = await ctx.params;
  const id = Number(rawId);
  if (!Number.isInteger(id)) return Response.json({ ok: false, error: "ID inválido" }, { status: 400 });

  const rows = await db.select().from(activities).where(and(eq(activities.id, id), eq(activities.userId, user.id))).limit(1);
  const activity = rows[0];
  if (!activity) return Response.json({ ok: false, error: "Atividade não encontrada" }, { status: 404 });

  const body = (await request.json().catch(() => null)) as Patch | null;
  if (!body) return Response.json({ ok: false, error: "Payload inválido" }, { status: 400 });

  const updates: Partial<typeof activities.$inferInsert> = {};
  if (typeof body.name === "string" && body.name.trim()) updates.name = body.name.trim().slice(0, 130);
  if (body.notes !== undefined) updates.notes = (body.notes ?? "").slice(0, 1200) || null;
  if (body.location !== undefined) updates.location = (body.location ?? "").slice(0, 150) || null;
  if (body.visibility && ["public", "followers", "private"].includes(body.visibility)) updates.visibility = body.visibility;
  if (typeof body.distanceM === "number" && body.distanceM >= 0) {
    updates.distanceM = Math.round(body.distanceM);
    updates.avgSpeedKmh = activity.movingSec > 0 ? Number(((body.distanceM / 1000) / (activity.movingSec / 3600)).toFixed(2)) : 0;
    updates.paceSecPerKm = body.distanceM > 30 && activity.movingSec > 0 ? Number((activity.movingSec / (body.distanceM / 1000)).toFixed(2)) : 0;
  }
  if (body.commute !== undefined) updates.commute = Boolean(body.commute);
  if (body.isIndoor !== undefined) updates.isIndoor = Boolean(body.isIndoor);
  if (body.weather !== undefined) updates.weather = (body.weather ?? "").slice(0, 50) || null;

  let summary = null as Awaited<ReturnType<typeof processActivity>> | null;
  let questEvents: Awaited<ReturnType<typeof creditActivityToQuests>> = [];
  const shouldPublish = Boolean(body.publish) && activity.status === "draft";
  if (shouldPublish) {
    updates.status = "published";
    updates.endedAt = new Date(activity.startedAt.getTime() + (activity.elapsedSec ?? 0) * 1000);
  }
  if (Object.keys(updates).length > 0) {
    await db.update(activities).set(updates).where(eq(activities.id, id));
  }

  if (shouldPublish) {
    const photos = await db.select({ id: activityPhotos.id }).from(activityPhotos).where(eq(activityPhotos.activityId, id));
    const [fresh] = await db.select().from(activities).where(eq(activities.id, id)).limit(1);
    if (fresh) {
      summary = await processActivity({ ...user, xp: user.xp, coins: user.coins }, fresh, {
        photosCount: photos.length,
        isNew: true,
      });
      // Integração RPG: a atividade real credita progresso nas missões compatíveis.
      // Cada atividade é creditada uma única vez por missão (anti-duplicidade).
      questEvents = await creditActivityToQuests({ ...user, xp: summary.totalXp, coins: summary.totalCoins }, fresh);
    }
  }

  return Response.json({ ok: true, summary, questEvents, sport: getSport(activity.sport).label });
}

export async function DELETE(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireApiUser();
  if (!user) return Response.json({ ok: false, error: "Não autenticado" }, { status: 401 });
  const { id: rawId } = await ctx.params;
  const id = Number(rawId);
  await db.delete(activities).where(and(eq(activities.id, id), eq(activities.userId, user.id)));
  return Response.json({ ok: true });
}
