import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { EmblemIcon } from "@/components/EmblemIcon";
import { emblemForAchievement } from "@/lib/emblems";
import { IconCoin, IconTrophy } from "@/components/icons";
import { Pill, ProgressBar } from "@/components/ui";
import { achievementsForUser } from "@/lib/gamification";
import { challengesForUser, territoriesForUser } from "@/lib/data";
import { loadQuestBoard, DIFFICULTY_META, questProgressLabel } from "@/lib/quests";
import { formatDistance, formatNumber, pct } from "@/lib/format";

export const dynamic = "force-dynamic";

const TABS = [
  { key: "missoes", label: "Missões" },
  { key: "desafios", label: "Desafios" },
  { key: "exploracao", label: "Exploração" },
  { key: "conquistas", label: "Conquistas" },
] as const;

export default async function MissionsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await requireUser();
  const { tab: rawTab } = await searchParams;
  const tab = TABS.find((t) => t.key === rawTab)?.key ?? "missoes";

  const [board, challenges, territories, achievements] = await Promise.all([
    loadQuestBoard(user.id, null),
    challengesForUser(user.id),
    territoriesForUser(user.id),
    achievementsForUser(user.id),
  ]);

  const quests = board.quests;
  const available = quests.filter((q) => q.state !== "completed");
  const done = quests.filter((q) => q.state === "completed");
  const bosses = available.filter((q) => q.kind === "boss");
  const chests = available.filter((q) => q.category === "chest" || q.category === "secret");
  const joined = challenges.filter((c) => c.joined);
  const open = challenges.filter((c) => !c.joined);
  const owned = territories.filter((t) => t.claimed);
  const unlocked = achievements.filter((a) => a.unlockedAt);
  const locked = achievements.filter((a) => !a.unlockedAt).sort((a, b) => b.progress / b.threshold - a.progress / a.threshold);

  return (
    <AppShell user={user} title="Missões" subtitle={`${available.length} ativas · ${done.length} concluídas`} right={<span className="metric flex items-center gap-1.5 border border-line px-2 py-1 text-[11px] font-bold text-lime"><IconCoin className="size-3" />{user.coins}</span>}>
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

      {tab === "missoes" ? (
        <div className="space-y-6">
          {bosses.length > 0 ? (
            <section>
              <p className="eyebrow mb-2.5">Bosses geográficos · {bosses.length}</p>
              <ul className="space-y-2">
                {bosses.map((q) => (
                  <li key={q.id} className="surface overflow-hidden">
                    <div className="flex items-start gap-3 p-4">
                      <EmblemIcon emblem={q.emblem} size={56} />
                      <div className="min-w-0 flex-1">
                        <p className="display-2 text-[14px]">{q.name}</p>
                        <p className="tabular mt-1 text-[11px] text-muted">
                          {DIFFICULTY_META[q.difficulty]?.label} · +{q.xpReward} XP · +{q.coinsReward} moedas
                        </p>
                        <div className="mt-2.5">
                          <div className="flex justify-between text-[10px] font-display font-bold uppercase tracking-[0.12em] text-muted">
                            <span>HP</span>
                            <span className="metric">{q.hp ?? 0}/{q.bossMaxHp}</span>
                          </div>
                          <div className="mt-1">
                            <ProgressBar pct={((q.hp ?? 0) / Math.max(1, q.bossMaxHp)) * 100} color="#ff6a3d" />
                          </div>
                        </div>
                      </div>
                    </div>
                    <Link href="/app/map" className="block border-t border-line px-4 py-2.5 text-[11px] font-display font-bold uppercase tracking-[0.12em] text-lime">
                      Ver no mapa →
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section>
            <p className="eyebrow mb-2.5">Baús e segredos · {chests.length}</p>
            {chests.length === 0 ? (
              <div className="surface px-4 py-5 text-[13px] text-muted">
                Nenhum baú revelado ainda. Gere missões pela sua região no mapa.
              </div>
            ) : (
              <ul className="divide-y divide-line border-y border-line">
                {chests.map((q) => (
                  <li key={q.id}>
                    <Link href="/app/map" className="flex items-center gap-3 py-3">
                      <EmblemIcon emblem={q.emblem} size={44} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-semibold">{q.name}</span>
                        <span className="tabular block truncate text-[11px] text-muted">
                          +{q.xpReward} XP · +{q.coinsReward} moedas · captura presencial
                        </span>
                      </span>
                      <Pill tone={q.category === "secret" ? "sky" : "gold"}>{q.category === "secret" ? "secreto" : "baú"}</Pill>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <p className="eyebrow mb-2.5">Todas as missões · {available.length}</p>
            <ul className="divide-y divide-line border-y border-line">
              {available.map((q) => (
                <li key={q.id}>
                  <Link href="/app/map" className="flex items-center gap-3 py-3">
                    <EmblemIcon emblem={q.emblem} size={40} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold">{q.name}</span>
                      <span className="tabular block truncate text-[11px] text-muted">
                        {questProgressLabel(q)} · {DIFFICULTY_META[q.difficulty]?.label}
                      </span>
                    </span>
                    <span className="metric shrink-0 text-[10px] font-bold uppercase tracking-[0.12em] text-muted">
                      {q.state === "unlocked" ? "capturar" : "ver"}
                    </span>
                  </Link>
                </li>
              ))}
              {available.length === 0 ? (
                <li className="py-5 text-[13px] text-muted">
                  Nenhuma missão ativa. Abra o mapa e gere objetivos pela sua região.
                </li>
              ) : null}
            </ul>
            <Link href="/app/map" className="btn btn-primary mt-4 w-full">
              Abrir mapa de exploração
            </Link>
          </section>

          {done.length > 0 ? (
            <section>
              <p className="eyebrow mb-2.5">Concluídas · {done.length}</p>
              <ul className="grid grid-cols-2 gap-2">
                {done.map((q) => (
                  <li key={q.id} className="surface flex items-center gap-2.5 p-3">
                    <EmblemIcon emblem={q.emblem} size={36} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12px] font-semibold">{q.name}</span>
                      <span className="metric block text-[10px] text-lime">+{q.xpReward} XP</span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      ) : null}

      {tab === "desafios" ? (
        <div className="space-y-6">
          <section>
            <p className="eyebrow mb-2.5">Ativos · {joined.length}</p>
            {joined.length === 0 ? (
              <div className="surface px-4 py-5 text-[13px] text-muted">
                Você não participa de nenhum desafio. Suas atividades do período contam automaticamente ao entrar.
              </div>
            ) : (
              <ul className="space-y-2">
                {joined.map((c) => (
                  <li key={c.id}>
                    <Link href={`/app/challenges/${c.id}`} className="surface block p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="display-2 text-[14px]">{c.name}</p>
                          <p className="mt-1 text-[11px] text-muted">
                            até {new Date(c.endAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
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
              {open.length === 0 ? <li className="py-4 text-[13px] text-muted">Nenhum desafio aberto.</li> : null}
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
            {owned.length === 0 ? (
              <div className="surface px-4 py-5 text-[13px] text-muted">
                Nenhum território dominado. Percorra 250 m dentro de uma área registrada.
              </div>
            ) : (
              <ul className="space-y-2">
                {owned.map((t) => (
                  <li key={t.id} className="surface flex items-start gap-3 p-4">
                    <EmblemIcon emblem="shield-star-laurel" size={42} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-semibold">{t.name}</p>
                      <p className="text-[11px] text-muted">{t.region}</p>
                      <p className="tabular mt-1.5 text-[11px] text-muted">
                        {formatDistance(t.myDistanceInsideM)} dentro · +{t.xpReward} XP
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <p className="eyebrow mb-2.5">Próximas áreas · {territories.length - owned.length}</p>
            <ul className="divide-y divide-line border-y border-line">
              {territories
                .filter((t) => !t.claimed)
                .map((t) => (
                  <li key={t.id} className="flex items-center gap-3 py-3.5">
                    <EmblemIcon emblem="compass" size={38} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold">{t.name}</p>
                      <p className="tabular truncate text-[11px] text-muted">
                        {t.region} · raio {formatDistance(t.radiusM, 0)} · +{t.xpReward} XP
                      </p>
                    </div>
                    <Link href="/app/map" className="btn btn-ghost shrink-0 px-3 py-2 text-[11px]">
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
            <Stat value={String(unlocked.length)} label="conquistas" />
            <Stat value={String(achievements.length)} label="no total" />
            <Stat value={String(user.coins)} label="moedas" accent />
          </div>

          <section>
            <p className="eyebrow mb-2.5">Desbloqueadas · {unlocked.length}</p>
            {unlocked.length === 0 ? (
              <div className="surface px-4 py-5 text-[13px] text-muted">
                Grave sua primeira atividade para desbloquear conquistas.
              </div>
            ) : (
              <ul className="grid grid-cols-2 gap-2">
                {unlocked.map((a) => (
                  <li key={a.key} className="surface p-3.5">
                    <EmblemIcon emblem={emblemForAchievement(a)} size={42} />
                    <p className="mt-2.5 text-[13px] font-semibold leading-tight">{a.name}</p>
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
                  <div className="flex items-start gap-3">
                    <EmblemIcon emblem={emblemForAchievement(a)} size={40} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold">{a.name}</p>
                      <p className="text-[11px] leading-snug text-muted">{a.description}</p>
                      <div className="mt-2">
                        <ProgressBar pct={pct(a.progress, a.threshold)} />
                      </div>
                      <p className="tabular mt-1 text-[10px] text-muted">
                        {formatNumber(Math.min(a.progress, a.threshold), 0)}/{formatNumber(a.threshold, 0)} {a.unit}
                      </p>
                    </div>
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
