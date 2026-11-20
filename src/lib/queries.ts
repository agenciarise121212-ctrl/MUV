import { db } from "@/db";
import { activities, activityPhotos, comments } from "@/db/schema";
import { asc, desc, eq, inArray } from "drizzle-orm";

export async function getActivity(id: number) {
  const [a] = await db.select().from(activities).where(eq(activities.id, id));
  if (!a) return null;
  const photos = await db.select({ id: activityPhotos.id, position: activityPhotos.position, lat: activityPhotos.lat, lng: activityPhotos.lng, kmMark: activityPhotos.kmMark, takenAt: activityPhotos.takenAt }).from(activityPhotos).where(eq(activityPhotos.activityId, id)).orderBy(asc(activityPhotos.position), asc(activityPhotos.id));
  const cs = await db.select().from(comments).where(eq(comments.activityId, id)).orderBy(asc(comments.createdAt));
  return { ...a, photos, comments: cs };
}

export async function listActivities(opts: { publishedOnly?: boolean } = {}) {
  const rows = await db.select().from(activities).orderBy(desc(activities.startedAt));
  const list = opts.publishedOnly ? rows.filter((r) => r.status === "published") : rows;
  const ids = list.map((r) => r.id);
  const photos = ids.length ? await db.select({ id: activityPhotos.id, activityId: activityPhotos.activityId, position: activityPhotos.position }).from(activityPhotos).where(inArray(activityPhotos.activityId, ids)).orderBy(asc(activityPhotos.position), asc(activityPhotos.id)) : [];
  const cs = ids.length ? await db.select({ activityId: comments.activityId }).from(comments).where(inArray(comments.activityId, ids)) : [];
  return list.map((r) => ({ ...r, photos: photos.filter((p) => p.activityId === r.id), commentCount: cs.filter((c) => c.activityId === r.id).length }));
}

// reduz pontos para envio ao cliente
export function simplify<T>(pts: T[], max = 600): T[] {
  if (pts.length <= max) return pts;
  const step = pts.length / max;
  const out: T[] = [];
  for (let i = 0; i < max; i++) out.push(pts[Math.floor(i * step)]);
  out.push(pts[pts.length - 1]);
  return out;
}
