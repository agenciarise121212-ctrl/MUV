import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { IconCoin, IconTrophy } from "@/components/icons";
import { Pill, ProgressBar } from "@/components/ui";
import { achievementsForUser } from "@/lib/gamification";
import { challengesForUser, territoriesForUser } from "@/lib/data";
import { formatDistance, formatNumber, pct } from "@/lib/format";

export const dynamic = "force-dynamic";

const TABS = [
  { key: "desafios", label: "Desafios" },
  { key: "exploracao", label: "Exploração" },
  { key: "conquistas", label: "Conquistas" },
] as const;

export default async function MissionsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await requireUser();
  const { tab: rawTab } = await searchParams;
  const tab = TABS.find((t) => t.key === rawTab)?.key ?? "desafios";

  const [challenges, territories, achievements] = await Promise.all([
    challengesForUser(user.id),
    territoriesForUser(user.id),
    achievementsForUser(user.id),
  ]);

  const joined = challenges.filter((c) => c.joined);
  const open = challenges.filter((c) => !c.joined);
  const owned = territories.filter((t) => t.claimed);
  const free = territories.filter((t) => !t.claimed);
  const unlocked = achievements.filter((a) => a.unlockedAt);
  const locked = achievements.filter((a) => !a.unlockedAt).sort((a, b) => b.progress / b.threshold - a.progress / a.threshold);

  return (
    <AppShell user={user} title="Missões" subtitle="Desafios, exploração e conquistas">
      {/* Abas compactas */}
      <div className="no-scrollbar -mx-4 mb-5 flex gap-2 overflow-x-auto px-4">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/app/missions?tab=${t.key}`}
            className={`shrink-0 border px-3.5 py-2 text-[11px] font-display font-bold uppercase tracking-[0.12em] transition-colors ${
              tab === t.key ? "border-lime bg-lime text-ink" : "border-line text-muted"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {tab === "desafios" ? (
        <div className="space-y-6">
          <section>
            <p className="eyebrow mb-2.5">Ativos · {joined.length}</p>
            {joined.length === 0 ? (
              <div className="surface px-4 py-6 text-center">
                <p className="text-[13px] text-muted">Você não está em nenhum desafio. Entre em um abaixo — suas atividades do período contam automaticamente.</p>
              </div>
            ) : (
              <ul className="space-y-2">
                {joined.map((c) => (
                  <li key={c.id}>
                    <Link href={`/app/challenges/${c.id}`} className="surface hover-lift block p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="display-2 text-[14px]">{c.name}</p>
                          <p className="mt-1 text-[11px] text-muted">
                            {c.sport ? c.sport : "Todas as modalidades"} · termina{" "}
                            {new Date(c.endAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                          </p>
                        </div>
                        {c.myCompletedAt ? <Pill tone="gold">Feito</Pill> : null}
                      </div>
                      <div className="mt-3">
                        <ProgressBar pct={pct(c.myProgress, c.target)} color="#ff6a3d" />
                      </div>
                      <p className="tabular mt-1.5 text-[11px] text-muted">
                        {formatNumber(c.myProgress, c.unit === "km" ? 1 : 0)} / {formatNumber(c.target, c.unit === "km" ? 1 : 0)} {c.unit}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <p className="eyebrow mb-2.5">Disponíveis · {open.length}</p>
            <ul className="divide-y divide-line border-y border-line">
              {open.map((c) => (
                <li key={c.id} className="flex items-center gap-3 py-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold">{c.name}</p>
                    <p className="tabular truncate text-[11px] text-muted">
                      Meta {formatNumber(c.target, c.unit === "km" ? 1 : 0)} {c.unit} · {c.participants} participante(s)
                    </p>
                  </div>
                  <Link href={`/app/challenges/${c.id}`} className="btn btn-primary shrink-0 px-3.5 py-2 text-[11px]">
                    Ver
                  </Link>
                </li>
              ))}
              {open.length === 0 ? <li className="py-4 text-[13px] text-muted">Nenhum desafio aberto. Crie um e convide a comunidade.</li> : null}
            </ul>
            <Link href="/app/challenges" className="btn btn-dark mt-4 w-full">
              <IconTrophy className="size-4" />
              Gerenciar desafios
            </Link>
          </section>
        </div>
      ) : null}

      {tab === "exploracao" ? (
        <div className="space-y-6">
          <div className="surface p-4">
            <div className="flex items-center justify-between">
              <p className="eyebrow">Progresso de domínio</p>
              <span className="metric text-[13px] font-bold text-lime">
                {owned.length}/{territories.length}
              </span>
            </div>
            <div className="mt-3">
              <ProgressBar pct={(owned.length / Math.max(1, territories.length)) * 100} />
            </div>
          </div>

          <section>
            <p className="eyebrow mb-2.5">Dominados · {owned.length}</p>
            <ul className="space-y-2">
              {owned.map((t) => (
                <li key={t.id} className="surface p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold">{t.name}</p>
                      <p className="text-[11px] text-muted">{t.region}</p>
                    </div>
                    <Pill tone="lime">Dominado</Pill>
                  </div>
                  <p className="tabular mt-2.5 text-[11px] text-muted">
                    {formatDistance(t.myDistanceInsideM)} dentro do território · +{t.xpReward} XP
                  </p>
                </li>
              ))}
              {owned.length === 0 ? <li className="surface px-4 py-6 text-center text-[13px] text-muted">Nenhum território dominado ainda. Percorra 250 m dentro de uma área.</li> : null}
            </ul>
          </section>

          <section>
            <p className="eyebrow mb-2.5">Próximas missões · {free.length}</p>
            <ul className="divide-y divide-line border-y border-line">
              {free.map((t) => (
                <li key={t.id} className="flex items-center gap-3 py-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold">{t.name}</p>
                    <p className="tabular truncate text-[11px] text-muted">
                      {t.region} · raio {formatDistance(t.radiusM, 0)} · +{t.xpReward} XP
                    </p>
                  </div>
                  <Link href="/app/map" className="btn btn-ghost shrink-0 px-3.5 py-2 text-[11px]">
                    Mapa
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>
      ) : null}

      {tab === "conquistas" ? (
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-px border border-line bg-line">
            <Stat value={String(unlocked.length)} label="desbloqueadas" />
            <Stat value={String(achievements.length)} label="no total" />
            <Stat value={String(user.coins)} label="moedas" accent />
          </div>

          <section>
            <p className="eyebrow mb-2.5">Desbloqueadas · {unlocked.length}</p>
            {unlocked.length === 0 ? (
              <div className="surface px-4 py-6 text-center text-[13px] text-muted">Grave sua primeira atividade para desbloquear conquistas.</div>
            ) : (
              <ul className="grid grid-cols-2 gap-2">
                {unlocked.map((a) => (
                  <li key={a.key} className="surface p-3.5">
                    <p className="display-2 text-[13px] normal-case">{a.name}</p>
                    <p className="mt-1 text-[11px] leading-snug text-muted">{a.description}</p>
                    <p className="metric mt-2 text-[10px] font-bold text-lime">+{a.xpReward} XP</p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <p className="eyebrow mb-2.5">Em progresso · {locked.length}</p>
            <ul className="divide-y divide-line border-y border-line">
              {locked.slice(0, 12).map((a) => (
                <li key={a.key} className="py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-semibold">{a.name}</p>
                      <p className="text-[11px] leading-snug text-muted">{a.description}</p>
                    </div>
                    <span className="metric shrink-0 text-[11px] font-bold text-muted">
                      {formatNumber(Math.min(a.progress, a.threshold), 0)}/{formatNumber(a.threshold, 0)}
                    </span>
                  </div>
                  <div className="mt-2">
                    <ProgressBar pct={pct(a.progress, a.threshold)} />
                  </div>
                </li>
              ))}
            </ul>
            <Link href="/app/rewards" className="btn btn-dark mt-4 w-full">
              <IconCoin className="size-4" />
              Ver recompensas
            </Link>
          </section>
        </div>
      ) : null}
    </AppShell>
  );
}

function Stat({ value, label, accent }: { value: string; label: string; accent?: boolean }) {
  return (
    <div className="bg-graphite px-2 py-3.5 text-center">
      <p className={`metric text-[19px] font-black ${accent ? "text-lime" : ""}`}>{value}</p>
      <p className="mt-0.5 text-[9px] font-display font-bold uppercase tracking-[0.14em] text-muted">{label}</p>
    </div>
  );
}
