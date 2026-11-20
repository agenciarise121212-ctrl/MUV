"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import Link from "next/link";
import { Icon, LogoMark } from "@/components/icons.client";

/**
 * Leitura defensiva da resposta: verifica `res.ok` e o Content-Type antes de
 * chamar `res.json()`. Quando o servidor devolve HTML de erro (ex.: 502 do
 * proxy, banco indisponível), o JSON.parse do Safari lança
 * "The string did not match the expected pattern." — este helper traduz isso
 * em uma mensagem clara em português.
 */
async function readJson(res: Response): Promise<{ ok: boolean; error?: string }> {
  const type = res.headers.get("content-type") ?? "";
  const raw = await res.text();

  if (!type.includes("application/json")) {
    return {
      ok: false,
      error: res.ok
        ? "Resposta inesperada do servidor. Tente novamente."
        : res.status >= 500
          ? "Servidor indisponível neste momento. Tente novamente em alguns segundos."
          : "Não foi possível concluir a operação. Tente novamente.",
    };
  }

  try {
    const parsed = JSON.parse(raw) as { ok?: boolean; error?: string };
    if (parsed && typeof parsed === "object") {
      return { ok: parsed.ok === true, error: typeof parsed.error === "string" ? parsed.error : undefined };
    }
    return { ok: false, error: "Resposta inválida do servidor." };
  } catch {
    return { ok: false, error: "Não foi possível ler a resposta do servidor. Tente novamente." };
  }
}

const DEMO = [
  { email: "ana@muv.app", name: "Ana Souza", detail: "Estrada · corrida de rua" },
  { email: "bruno@muv.app", name: "Bruno Lima", detail: "Trail · mountain bike" },
  { email: "carla@muv.app", name: "Carla Dias", detail: "Caminhada · hiking" },
];

function AuthForm() {
  const params = useSearchParams();
  const router = useRouter();
  const [mode, setMode] = useState<"signup" | "login">(params.get("mode") === "login" ? "login" : "signup");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: mode,
          name: String(form.get("name") ?? "").trim(),
          username: String(form.get("username") ?? "").trim(),
          email: String(form.get("email") ?? "").trim(),
          password: String(form.get("password") ?? ""),
          city: String(form.get("city") ?? "").trim(),
        }),
      });
      if (!res.ok && res.status >= 500) {
        const soft = await readJson(res);
        throw new Error(soft.error ?? "Servidor indisponível. Tente novamente.");
      }
      const json = await readJson(res);
      if (!json.ok) throw new Error(json.error ?? "Não foi possível concluir a operação.");
      router.push("/app");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro de autenticação");
    } finally {
      setBusy(false);
    }
  }

  async function demoLogin(email: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "login", email, password: "muv1234" }),
      });
      const json = await readJson(res);
      if (!json.ok) throw new Error(json.error ?? "Não foi possível entrar com o atleta de demonstração.");
      router.push("/app");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro no login do atleta demo");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_1.05fr]">
      {/* Painel de marca */}
      <aside className="relative hidden flex-col justify-between overflow-hidden border-r border-line bg-graphite p-10 lg:flex">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.14]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(115deg, transparent 0 26px, #2a2d33 26px 27px)",
          }}
        />
        <Link href="/" className="relative flex items-center gap-2">
          <LogoMark className="size-6" />
          <span className="font-display text-[16px] font-black uppercase tracking-[0.2em]">MUV</span>
        </Link>
        <div className="relative">
          <h2 className="display-1 text-[clamp(2.2rem,3.6vw,3.4rem)]">
            Seu movimento.
            <br />
            <span className="text-lime">Seu território.</span>
          </h2>
          <p className="mt-6 max-w-sm text-[14px] leading-relaxed text-muted">
            Registre suas atividades. Explore novos caminhos. Descubra desafios e supere seus limites.
          </p>
        </div>
        <div className="relative grid grid-cols-3 gap-px border border-line bg-line">
          {[
            ["37", "conquistas"],
            ["8", "territórios"],
            ["3", "modalidades"],
          ].map(([v, l]) => (
            <div key={l} className="bg-graphite px-4 py-4">
              <p className="metric text-lg font-black text-lime">{v}</p>
              <p className="mt-0.5 text-[9px] font-display font-bold uppercase tracking-[0.16em] text-muted">{l}</p>
            </div>
          ))}
        </div>
      </aside>

      {/* Formulário */}
      <main className="flex flex-col justify-center px-5 py-10 sm:px-10 lg:px-14">
        <Link href="/" className="mb-8 flex items-center gap-2 lg:hidden">
          <LogoMark className="size-5" />
          <span className="font-display text-[15px] font-black uppercase tracking-[0.2em]">MUV</span>
        </Link>

        <p className="eyebrow">{mode === "signup" ? "Criar conta" : "Acesso"}</p>
        <h1 className="display-1 mt-3 text-[clamp(1.9rem,6vw,2.8rem)]">
          {mode === "signup" ? "Comece agora" : "Bem-vindo de volta"}
        </h1>
        <p className="mt-3 max-w-md text-[14px] leading-relaxed text-muted">
          {mode === "signup"
            ? "Crie sua conta para registrar corridas, trilhas e pedais com GPS real."
            : "Continue treinando, dominando territórios e disputando desafios."}
        </p>

        <form onSubmit={submit} className="mt-8 max-w-md space-y-4">
          {mode === "signup" ? (
            <>
              <Field label="Nome" name="name" placeholder="Seu nome" autoComplete="name" />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Usuário" name="username" placeholder="atleta123" autoComplete="username" />
                <Field label="Cidade" name="city" placeholder="São Paulo, SP" />
              </div>
            </>
          ) : null}
          <Field label="E-mail" name="email" type="email" inputMode="email" placeholder="voce@email.com" autoComplete="email" />
          <Field label="Senha" name="password" type="password" placeholder="Mínimo 6 caracteres" autoComplete={mode === "signup" ? "new-password" : "current-password"} />

          {error ? (
            <p className="border border-flame/40 bg-flame/10 px-3 py-2 text-[12px] text-flame">{error}</p>
          ) : null}

          <button type="submit" disabled={busy} className="btn btn-primary w-full py-3.5 text-[13px]">
            {busy ? "Aguarde…" : mode === "signup" ? "Criar conta" : "Entrar"}
          </button>
          <button
            type="button"
            onClick={() => setMode(mode === "signup" ? "login" : "signup")}
            className="flex w-full items-center justify-center gap-1.5 py-1 text-[11px] font-display font-bold uppercase tracking-[0.14em] text-muted transition-colors hover:text-paper"
          >
            {mode === "signup" ? "Já tenho conta" : "Não tenho conta"}
            <Icon.arrow className="size-3.5" />
          </button>
        </form>

        <div className="mt-10 max-w-md border-t border-line pt-6">
          <p className="eyebrow mb-3">Atletas de demonstração</p>
          <div className="divide-y divide-line border border-line">
            {DEMO.map((d) => (
              <button
                key={d.email}
                type="button"
                onClick={() => void demoLogin(d.email)}
                disabled={busy}
                className="group flex w-full items-center gap-3 bg-graphite px-4 py-3 text-left transition-colors hover:bg-graphite-2"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-lime font-display text-[12px] font-black text-ink">
                  {d.name.split(" ").map((n) => n[0]).join("")}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-semibold">{d.name}</span>
                  <span className="block truncate text-[11px] text-muted">{d.detail} · senha muv1234</span>
                </span>
                <Icon.chevron className="size-3.5 text-muted transition-transform group-hover:translate-x-0.5" />
              </button>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  placeholder,
  autoComplete,
  inputMode,
}: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
  inputMode?: "text" | "email" | "numeric" | "decimal";
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[9px] font-display font-bold uppercase tracking-[0.18em] text-muted">{label}</span>
      <input
        name={name}
        type={type}
        placeholder={placeholder}
        autoComplete={autoComplete}
        inputMode={inputMode}
        // Sem atributo `pattern`: o Safari aplica a validação de regex antes do
        // submit e reporta o erro genérico que o usuário viu. A validação de
        // formato agora é feita no servidor, com mensagem em português.
        className="field py-3"
      />
    </label>
  );
}

export default function EntrarPage() {
  return (
    <Suspense fallback={<div className="grid min-h-screen place-items-center text-[13px] text-muted">Carregando…</div>}>
      <AuthForm />
    </Suspense>
  );
}
