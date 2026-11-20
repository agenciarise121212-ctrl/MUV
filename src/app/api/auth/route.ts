import { eq, or } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { createSession, destroySession, hashPassword, verifyPassword } from "@/lib/auth";
import { ensureAchievementCatalog } from "@/lib/gamification";

export const dynamic = "force-dynamic";

const COLORS = ["volt", "flame", "sky", "mint", "grape", "sun", "rose"];

export async function POST(request: Request) {
  // Toda resposta desta rota é JSON válido — inclusive em falha de banco ou
  // erro inesperado. Sem isso, o Safari recebe HTML de erro e quebra o
  // JSON.parse com "The string did not match the expected pattern."
  try {
    return await handleAuth(request);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const isConnection = /connect|ECONNREFUSED|ENOTFOUND|timeout|relation .* does not exist/i.test(message);
    return Response.json(
      {
        ok: false,
        error: isConnection
          ? "Banco de dados indisponível neste momento. Tente novamente em alguns segundos."
          : "Não foi possível concluir a operação. Verifique os dados e tente novamente.",
      },
      { status: 503 },
    );
  }
}

async function handleAuth(request: Request): Promise<Response> {
  const body = (await request.json().catch(() => null)) as
    | { action?: string; name?: string; username?: string; email?: string; password?: string; city?: string }
    | null;
  if (!body?.action) return Response.json({ ok: false, error: "Ação inválida" }, { status: 400 });

  // Normalização: sem espaços extras, sem maiúsculas indevidas.
  const cleanName = (body.name ?? "").trim().replace(/\s+/g, " ").slice(0, 100);
  const cleanUsername = (body.username ?? "").trim().toLowerCase().replace(/\s+/g, "").slice(0, 32);

  if (body.action === "logout") {
    await destroySession();
    return Response.json({ ok: true });
  }

  const email = (body.email ?? "").trim().toLowerCase().slice(0, 180);
  const password = typeof body.password === "string" ? body.password : "";
  if (!email || !password) return Response.json({ ok: false, error: "Informe e-mail e senha" }, { status: 400 });

  // Validação defensiva de formato: mensagens em português, sem regex de
  // HTML5 (que o Safari aplica de forma diferente e dispara o erro genérico).
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
  if (!emailOk) {
    return Response.json({ ok: false, error: "Informe um e-mail válido, como nome@exemplo.com" }, { status: 400 });
  }

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
    const name = cleanName;
    const username = cleanUsername.replace(/[^a-z0-9_.]/g, "");
    if (!name) return Response.json({ ok: false, error: "Informe seu nome" }, { status: 400 });
    if (!username) return Response.json({ ok: false, error: "Escolha um nome de usuário (letras, números, ponto e traço)" }, { status: 400 });
    if (username.length < 3) return Response.json({ ok: false, error: "O nome de usuário precisa ter pelo menos 3 caracteres" }, { status: 400 });
    if (password.length < 6) {
      return Response.json({ ok: false, error: "A senha precisa ter pelo menos 6 caracteres" }, { status: 400 });
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
        city: (body.city ?? "").trim().slice(0, 110) || null,
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
