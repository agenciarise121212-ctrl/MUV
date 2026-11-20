"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { Icon } from "@/components/icons.client";
import { timeAgo } from "@/lib/format";

export function FollowButton({ userId, initialFollowing }: { userId: number; initialFollowing: boolean }) {
  const [following, setFollowing] = useState(initialFollowing);
  const [busy, setBusy] = useState(false);
  async function toggle() {
    setBusy(true);
    try {
      const res = await fetch("/api/follow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const json = (await res.json()) as { ok: boolean; following?: boolean };
      if (json.ok) setFollowing(Boolean(json.following));
    } finally {
      setBusy(false);
    }
  }
  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      className={`rounded-full px-4 py-2 text-[11px] font-display font-bold uppercase tracking-[0.12em] ${following ? "bg-surface-2 text-muted hairline" : "bg-lime text-ink"}`}
    >
      {following ? "Seguindo" : "Seguir"}
    </button>
  );
}

export function JoinChallengeButton({ challengeId, joined }: { challengeId: number; joined: boolean }) {
  const router = useRouter();
  const [isJoined, setIsJoined] = useState(joined);
  const [busy, setBusy] = useState(false);
  async function toggle() {
    setBusy(true);
    try {
      await fetch("/api/challenges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: isJoined ? "leave" : "join", id: challengeId }),
      });
      setIsJoined(!isJoined);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }
  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      className={`rounded-full px-4 py-2 text-[11px] font-display font-bold uppercase tracking-[0.12em] ${isJoined ? "bg-surface-2 text-muted hairline" : "bg-lime text-ink"}`}
    >
      {isJoined ? "Participando" : "Participar"}
    </button>
  );
}

export function CreateChallengeForm({ sports }: { sports: { key: string; label: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/challenges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          name: form.get("name"),
          description: form.get("description"),
          sport: form.get("sport") || null,
          metric: form.get("metric"),
          target: Number(form.get("target")),
          unit: form.get("unit"),
          emoji: form.get("emoji") || "🏆",
          days: Number(form.get("days")),
        }),
      });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!json.ok) throw new Error(json.error ?? "Erro ao criar desafio");
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar desafio");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn btn-primary">
        + Criar desafio
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="border border-line bg-graphite p-4">
      <p className="text-[14px] font-semibold">Novo desafio</p>
      <input name="name" required placeholder="Nome do desafio" className="mt-3 w-full bg-ink px-3 py-2 text-sm hairline" />
      <textarea
        name="description"
        placeholder="Descreva o desafio"
        rows={2}
        className="mt-2 w-full bg-ink px-3 py-2 text-sm hairline"
      />
      <div className="mt-2 grid grid-cols-2 gap-2">
        <select name="sport" className="bg-ink px-3 py-2 text-sm hairline">
          <option value="">Todas as modalidades</option>
          {sports.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
        <select name="metric" className="bg-ink px-3 py-2 text-sm hairline">
          <option value="distance_m">Distância</option>
          <option value="elev_gain_m">Elevação</option>
          <option value="moving_sec">Tempo</option>
          <option value="activities_count">Atividades</option>
        </select>
        <input name="target" required inputMode="decimal" placeholder="Meta (ex: 50)" className="bg-ink px-3 py-2 text-sm hairline" />
        <input name="unit" defaultValue="km" placeholder="Unidade" className="bg-ink px-3 py-2 text-sm hairline" />
        <input name="emoji" defaultValue="🏆" placeholder="Emoji" className="bg-ink px-3 py-2 text-sm hairline" />
        <input name="days" defaultValue="30" inputMode="numeric" placeholder="Duração (dias)" className="bg-ink px-3 py-2 text-sm hairline" />
      </div>
      {error ? <p className="mt-2 text-xs text-flame">{error}</p> : null}
      <div className="mt-3 flex gap-2">
        <button type="submit" disabled={busy} className="flex-1  bg-lime py-2 text-[14px] font-semibold text-ink">
          Criar
        </button>
        <button type="button" onClick={() => setOpen(false)} className="bg-graphite-2 px-4 py-2 text-sm font-semibold text-muted hairline">
          Cancelar
        </button>
      </div>
    </form>
  );
}

export function RedeemButton({ rewardId, cost, coins }: { rewardId: number; cost: number; coins: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const canAfford = coins >= cost;
  async function redeem() {
    setBusy(true);
    try {
      const res = await fetch(`/api/rewards/${rewardId}`, { method: "POST" });
      const json = (await res.json()) as { ok: boolean; error?: string; redemption?: { code: string } };
      setMessage(json.ok ? `Resgatado! Código ${json.redemption?.code}` : (json.error ?? "Erro"));
      if (json.ok) router.refresh();
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <button
        type="button"
        onClick={redeem}
        disabled={busy || !canAfford}
        className={`w-full  py-2 text-[14px] font-semibold ${canAfford ? "bg-lime text-ink" : "bg-surface-2 text-muted hairline"}`}
      >
        {canAfford ? "Resgatar" : `Faltam ${cost - coins} moedas`}
      </button>
      {message ? <p className="mt-1 text-[11px] text-lime">{message}</p> : null}
    </div>
  );
}

export function DeleteActivityButton({ activityId }: { activityId: number }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  async function remove() {
    setBusy(true);
    await fetch(`/api/activities/${activityId}`, { method: "DELETE" });
    router.push("/app/activities");
    router.refresh();
  }
  if (!confirming) {
    return (
      <button type="button" onClick={() => setConfirming(true)} className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-display font-bold uppercase tracking-[0.12em] text-muted">
        <Icon.trash className="size-4" /> Excluir
      </button>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <button type="button" onClick={remove} disabled={busy} className="btn bg-flame text-ink">
        Confirmar
      </button>
      <button type="button" onClick={() => setConfirming(false)} className="rounded-full bg-surface-2 px-3 py-1.5 text-[11px] font-display font-bold uppercase tracking-[0.12em] text-muted hairline">
        Cancelar
      </button>
    </div>
  );
}

export function ClaimTerritoriesButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  async function check() {
    setBusy(true);
    try {
      const res = await fetch("/api/territories", { method: "POST" });
      const json = (await res.json()) as { ok: boolean; claimed?: { name: string; emoji: string }[]; xpEarned?: number };
      setResult(
        json.ok && (json.claimed?.length ?? 0) > 0
          ? `${json.claimed!.map((c) => `${c.emoji} ${c.name}`).join(", ")} dominados! +${json.xpEarned} XP`
          : "Nenhum território novo nos seus últimos trajetos.",
      );
      router.refresh();
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <button type="button" onClick={check} disabled={busy} className="rounded-full bg-sky px-4 py-2 text-[11px] font-display font-bold uppercase tracking-[0.12em] text-ink">
        {busy ? "Verificando…" : "Verificar territórios nos meus trajetos"}
      </button>
      {result ? <p className="mt-2 text-[11px] text-sky">{result}</p> : null}
    </div>
  );
}

export function CommentComposer({ activityId }: { activityId: number }) {
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    try {
      await fetch(`/api/activities/${activityId}/social`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "comment", body }),
      });
      setBody("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="flex gap-2">
      <input
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Comentar no treino do atleta…"
        className="flex-1 rounded-full bg-ink px-4 py-2.5 text-sm hairline"
      />
      <button type="submit" disabled={busy || !body.trim()} className="rounded-full bg-lime px-4 py-2 text-[14px] font-semibold text-ink">
        Enviar
      </button>
    </form>
  );
}

export function CommentList({
  comments,
}: {
  comments: { id: number; body: string; createdAt: string; userId: number; name: string; username: string; avatarColor: string }[];
}) {
  return (
    <ul className="space-y-3">
      {comments.map((c) => (
        <li key={c.id} className="flex gap-3">
          <Avatar name={c.name} color={c.avatarColor} size={34} href={`/app/athletes/${c.username}`} />
          <div className="min-w-0 flex-1 bg-graphite-2 px-3 py-2">
            <p className="text-[11px] font-display font-bold uppercase tracking-[0.12em]">
              {c.name} <span className="font-normal text-muted">· {timeAgo(c.createdAt)}</span>
            </p>
            <p className="mt-0.5 text-sm leading-relaxed">{c.body}</p>
          </div>
        </li>
      ))}
      {comments.length === 0 ? <li className="text-[13px] text-muted">Seja o primeiro a comentar.</li> : null}
    </ul>
  );
}

export function ProfileEditor({
  user,
}: {
  user: { name: string; username: string; bio: string | null; city: string | null; avatarColor: string; weightKg: number | null; autoPause: boolean };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.get("name"),
          username: form.get("username"),
          bio: form.get("bio"),
          city: form.get("city"),
          avatarColor: form.get("avatarColor"),
          weightKg: Number(form.get("weightKg")),
          autoPause: form.get("autoPause") === "on",
        }),
      });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!json.ok) throw new Error(json.error ?? "Erro ao salvar");
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button type="button" onClick={() => setOpen(true)} className="btn btn-dark">
        Editar perfil
      </button>
      {open ? (
        <div className="fixed inset-0 z-40 flex items-end bg-black/70" onClick={() => setOpen(false)}>
          <form
            onSubmit={submit}
            onClick={(e) => e.stopPropagation()}
            className="glass max-h-[88vh] w-full overflow-y-auto rounded-t-3xl p-5 hairline border-b-0"
          >
            <p className="text-base font-bold">Editar perfil</p>
            <label className="mt-3 block text-[11px] font-semibold uppercase tracking-wider text-muted">Nome</label>
            <input name="name" defaultValue={user.name} className="mt-1 w-full bg-ink px-3 py-2 text-sm hairline" />
            <label className="mt-3 block text-[11px] font-semibold uppercase tracking-wider text-muted">Usuário</label>
            <input name="username" defaultValue={user.username} className="mt-1 w-full bg-ink px-3 py-2 text-sm hairline" />
            <label className="mt-3 block text-[11px] font-semibold uppercase tracking-wider text-muted">Bio</label>
            <textarea name="bio" defaultValue={user.bio ?? ""} rows={2} className="mt-1 w-full bg-ink px-3 py-2 text-sm hairline" />
            <label className="mt-3 block text-[11px] font-semibold uppercase tracking-wider text-muted">Cidade</label>
            <input name="city" defaultValue={user.city ?? ""} className="mt-1 w-full bg-ink px-3 py-2 text-sm hairline" />
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted">Peso (kg)</label>
                <input name="weightKg" defaultValue={user.weightKg ?? 72} inputMode="decimal" className="mt-1 w-full bg-ink px-3 py-2 text-sm hairline" />
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted">Cor do avatar</label>
                <select name="avatarColor" defaultValue={user.avatarColor} className="mt-1 w-full bg-ink px-3 py-2 text-sm hairline">
                  {["volt", "flame", "sky", "mint", "grape", "sun", "rose"].map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <label className="mt-4 flex items-center gap-2 text-sm">
              <input type="checkbox" name="autoPause" defaultChecked={user.autoPause} className="size-4 accent-volt" />
              Pausa automática durante a gravação
            </label>
            {error ? <p className="mt-2 text-xs text-flame">{error}</p> : null}
            <div className="mt-4 flex gap-2">
              <button type="submit" disabled={busy} className="flex-1  bg-lime py-2.5 text-[14px] font-semibold text-ink">
                Salvar
              </button>
              <button type="button" onClick={() => setOpen(false)} className="bg-graphite-2 px-4 py-2.5 text-sm font-semibold text-muted hairline">
                Cancelar
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}

export function LogoutButton() {
  const router = useRouter();
  async function logout() {
    await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "logout" }),
    });
    router.push("/");
    router.refresh();
  }
  return (
    <button type="button" onClick={logout} className="w-full bg-graphite-2 py-3 text-[14px] font-semibold text-flame hairline">
      Sair da conta
    </button>
  );
}

export function SegmentsHint({ segmentId }: { segmentId: number }) {
  return (
    <Link href={`/app/segments/${segmentId}`} className="text-xs font-semibold text-lime">
      Ver ranking completo
    </Link>
  );
}
