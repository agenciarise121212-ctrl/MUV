import { eq, or } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { createSession, destroySession, hashPassword, verifyPassword } from "@/lib/auth";
import { ensureAchievementCatalog } from "@/lib/gamification";

export const dynamic = "force-dynamic";

const COLORS = ["volt", "flame", "sky", "mint", "grape", "sun", "rose"];

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { action?: string; name?: string; username?: string; email?: string; password?: string; city?: string }
    | null;
  if (!body?.action) return Response.json({ ok: false, error: "Ação inválida" }, { status: 400 });

  if (body.action === "logout") {
    await destroySession();
    return Response.json({ ok: true });
  }

  const email = (body.email ?? "").trim().toLowerCase();
  const password = body.password ?? "";
  if (!email || !password) return Response.json({ ok: false, error: "Informe e-mail e senha" }, { status: 400 });

  if (body.action === "login") {
    const rows = await db.select().from(users).where(eq(users.email, email)).limit(1);
    const user = rows[0];
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return Response.json({ ok: false, error: "E-mail ou senha incorretos" }, { status: 401 });
    }
    await createSession(user.id);
    return Response.json({ ok: true });
  }

  if (body.action === "signup") {
    await ensureAchievementCatalog();
    const name = (body.name ?? "").trim();
    let username = (body.username ?? "").trim().toLowerCase().replace(/[^a-z0-9_.]/g, "");
    if (!name || !username || password.length < 6) {
      return Response.json({ ok: false, error: "Preencha nome, usuário e senha (mín. 6 caracteres)" }, { status: 400 });
    }
    const existing = await db
      .select({ id: users.id, username: users.username, email: users.email })
      .from(users)
      .where(or(eq(users.email, email), eq(users.username, username)))
      .limit(1);
    if (existing.length > 0) {
      return Response.json(
        { ok: false, error: existing[0].email === email ? "E-mail já cadastrado" : "Usuário já existe" },
        { status: 409 },
      );
    }
    const [created] = await db
      .insert(users)
      .values({
        name,
        username,
        email,
        passwordHash: hashPassword(password),
        city: body.city?.trim() || null,
        avatarColor: COLORS[Math.floor(Math.random() * COLORS.length)],
        xp: 0,
        coins: 50,
      })
      .returning({ id: users.id, username: users.username });
    await createSession(created.id);
    return Response.json({ ok: true });
  }

  return Response.json({ ok: false, error: "Ação desconhecida" }, { status: 400 });
}
