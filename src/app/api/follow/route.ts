import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { follows, users } from "@/db/schema";
import { requireApiUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await requireApiUser();
  if (!user) return Response.json({ ok: false, error: "Não autenticado" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { userId?: number; username?: string } | null;
  let targetId = Number(body?.userId);
  if (!Number.isInteger(targetId) && body?.username) {
    const rows = await db.select({ id: users.id }).from(users).where(eq(users.username, body.username)).limit(1);
    targetId = rows[0]?.id ?? NaN;
  }
  if (!Number.isInteger(targetId) || targetId === user.id) {
    return Response.json({ ok: false, error: "Atleta inválido" }, { status: 400 });
  }
  const existing = await db
    .select({ id: follows.id })
    .from(follows)
    .where(and(eq(follows.followerId, user.id), eq(follows.followingId, targetId)))
    .limit(1);
  if (existing.length > 0) {
    await db.delete(follows).where(eq(follows.id, existing[0].id));
    return Response.json({ ok: true, following: false });
  }
  await db.insert(follows).values({ followerId: user.id, followingId: targetId });
  return Response.json({ ok: true, following: true });
}
