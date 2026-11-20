import { eq, ne, and } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireApiUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request) {
  const user = await requireApiUser();
  if (!user) return Response.json({ ok: false, error: "Não autenticado" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as
    | {
        name?: string;
        username?: string;
        bio?: string;
        city?: string;
        avatarColor?: string;
        weightKg?: number;
        sex?: string;
        autoPause?: boolean;
      }
    | null;
  if (!body) return Response.json({ ok: false, error: "Payload inválido" }, { status: 400 });

  const updates: Partial<typeof users.$inferInsert> = {};
  if (body.name?.trim()) updates.name = body.name.trim().slice(0, 110);
  if (body.bio !== undefined) updates.bio = (body.bio ?? "").slice(0, 260) || null;
  if (body.city !== undefined) updates.city = (body.city ?? "").slice(0, 110) || null;
  if (body.avatarColor) updates.avatarColor = body.avatarColor.slice(0, 20);
  if (Number.isFinite(body.weightKg)) updates.weightKg = Math.min(200, Math.max(30, Number(body.weightKg)));
  if (body.sex && ["m", "f", "x"].includes(body.sex)) updates.sex = body.sex;
  if (body.autoPause !== undefined) updates.autoPause = Boolean(body.autoPause);
  if (body.username && body.username.trim().toLowerCase() !== user.username) {
    const username = body.username.trim().toLowerCase().replace(/[^a-z0-9_.]/g, "");
    if (username.length < 3) return Response.json({ ok: false, error: "Usuário muito curto" }, { status: 400 });
    const taken = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.username, username), ne(users.id, user.id)))
      .limit(1);
    if (taken.length > 0) return Response.json({ ok: false, error: "Usuário já existe" }, { status: 409 });
    updates.username = username;
  }
  if (Object.keys(updates).length === 0) return Response.json({ ok: true });
  const [updated] = await db.update(users).set(updates).where(eq(users.id, user.id)).returning({ username: users.username });
  return Response.json({ ok: true, username: updated.username });
}
