import { requireUser } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { Card, Pill, ProgressBar } from "@/components/ui";
import { Avatar } from "@/components/Avatar";
import { RedeemButton } from "@/components/actions";
import { achievementsForUser, rewardsForUser } from "@/lib/data";
import { formatNumber, pct, timeAgo } from "@/lib/format";
import { levelFromXp } from "@/lib/levels";

export const dynamic = "force-dynamic";

const TIERS: Record<string, { label: string; color: string }> = {
  bronze: { label: "Bronze", color: "#c78e5a" },
  prata: { label: "Prata", color: "#c9d4e3" },
  ouro: { label: "Ouro", color: "#ffd43b" },
};

export default async function RewardsPage() {
  const user = await requireUser();
  const [{ catalog, mine }, achievements] = await Promise.all([rewardsForUser(user.id), achievementsForUser(user.id)]);
  const lvl = levelFromXp(user.xp);
  const unlocked = achievements.filter((a) => a.unlockedAt);
  const locked = achievements.filter((a) => !a.unlockedAt);
  const categories = Array.from(new Set(achievements.map((a) => a.category)));

  return (
    <AppShell user={user} title="Conquistas e recompensas" backHref="/app/profile">
      <Card className="p-4">
        <div className="flex items-center gap-3">
          <Avatar name={user.name} color={user.avatarColor} size={46} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black">
              Nível {lvl.level} · {lvl.title}
            </p>
            <p className="text-[11px] text-muted">
              {formatNumber(user.xp)} XP · {user.coins} moedas
            </p>
          </div>
        </div>
        <div className="mt-3">
          <ProgressBar pct={lvl.pct} />
          <p className="mt-1 text-[11px] text-muted">
            {lvl.next
              ? `Faltam ${formatNumber(lvl.next.minXp - user.xp)} XP para ${lvl.next.title}`
              : "Você chegou ao nível máximo. Lenda absoluta."}
          </p>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="tabular text-lg font-black text-lime">{unlocked.length}</p>
            <p className="text-[10px] uppercase tracking-wider text-muted">conquistas</p>
          </div>
          <div>
            <p className="tabular text-lg font-black">{achievements.length}</p>
            <p className="text-[10px] uppercase tracking-wider text-muted">no total</p>
          </div>
          <div>
            <p className="tabular text-lg font-black text-amber-300">{mine.length}</p>
            <p className="text-[10px] uppercase tracking-wider text-muted">resgates</p>
          </div>
        </div>
      </Card>

      <section className="mt-6">
        <h2 className="mb-2 text-[14px] font-semibold uppercase tracking-[0.16em] text-muted">Recompensas</h2>
        <p className="mb-3 text-[12px] text-muted">
          Troque suas moedas por kits, descontos e experiências esportivas parceiras.
        </p>
        <div className="space-y-2">
          {catalog.map((r) => (
            <Card key={r.id} className="p-4">
              <div className="flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center bg-graphite-2 text-lg">{r.emoji}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-semibold">{r.name}</p>
                  <p className="text-[11px] leading-snug text-muted">{r.description}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    <Pill tone="gold">{r.cost} moedas</Pill>
                    {r.partner ? <Pill>{r.partner}</Pill> : null}
                    <Pill tone={r.stock > 0 ? "sky" : "flame"}>{r.stock > 0 ? `${r.stock} disponíveis` : "esgotado"}</Pill>
                  </div>
                </div>
              </div>
              <div className="mt-3">
                <RedeemButton rewardId={r.id} cost={r.cost} coins={user.coins} />
              </div>
            </Card>
          ))}
          {catalog.length === 0 ? <Card className="p-4 text-[13px] text-muted">Catálogo em montagem.</Card> : null}
        </div>
      </section>

      {mine.length > 0 ? (
        <section className="mt-6">
          <h2 className="mb-2 text-[14px] font-semibold uppercase tracking-[0.16em] text-muted">Meus resgates</h2>
          <div className="space-y-2">
            {mine.map((m) => {
              const reward = catalog.find((r) => r.id === m.rewardId);
              return (
                <Card key={m.id} className="flex items-center gap-3 p-3">
                  <span className="text-lg">{reward?.emoji ?? "🎁"}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-semibold">{reward?.name ?? "Recompensa"}</p>
                    <p className="text-[11px] text-muted">
                      Código {m.code} · {timeAgo(m.createdAt)} atrás
                    </p>
                  </div>
                  <Pill tone={m.status === "usado" ? "muted" : "lime"}>{m.status}</Pill>
                </Card>
              );
            })}
          </div>
        </section>
      ) : null}

      <section className="mt-8">
        <h2 className="mb-2 text-[14px] font-semibold uppercase tracking-[0.16em] text-muted">Conquistas desbloqueadas</h2>
        {unlocked.length === 0 ? (
          <Card className="p-4 text-[13px] text-muted">
            Nenhuma conquista ainda. Grave uma atividade real para começar a desbloquear.
          </Card>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {unlocked.map((a) => (
              <Card key={a.key} className="p-3">
                <p className="text-xl">{a.icon}</p>
                <p className="mt-1 text-[13px] font-bold leading-tight">{a.name}</p>
                <p className="mt-1 text-[11px] leading-snug text-muted">{a.description}</p>
                <p className="mt-2 text-[10px] font-bold" style={{ color: TIERS[a.tier]?.color ?? "#d5ff45" }}>
                  {TIERS[a.tier]?.label ?? a.tier} · +{a.xpReward} XP
                </p>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="mt-8">
        <h2 className="mb-2 text-[14px] font-semibold uppercase tracking-[0.16em] text-muted">Próximas conquistas</h2>
        <div className="space-y-2">
          {locked.map((a) => (
            <Card key={a.key} className="p-3">
              <div className="flex items-start gap-3">
                <span className="grid size-9 shrink-0 place-items-center bg-graphite-2 text-base opacity-60">{a.icon}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-bold leading-tight">{a.name}</p>
                  <p className="text-[11px] leading-snug text-muted">{a.description}</p>
                  <div className="mt-2">
                    <ProgressBar pct={pct(a.progress, a.threshold)} color={TIERS[a.tier]?.color ?? "#d5ff45"} />
                  </div>
                  <p className="tabular mt-1 text-[10px] text-muted">
                    {formatNumber(Math.min(a.progress, a.threshold), a.threshold > 1000 ? 0 : 1)} /{" "}
                    {formatNumber(a.threshold, a.threshold > 1000 ? 0 : 1)} {a.unit}
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>
        <p className="mt-3 text-[11px] text-muted">Categorias acompanhadas: {categories.join(", ")}.</p>
      </section>
    </AppShell>
  );
}
