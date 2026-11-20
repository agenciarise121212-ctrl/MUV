import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { ActivityCard } from "@/components/ActivityCard";
import { Avatar } from "@/components/Avatar";
import { ProgressBar } from "@/components/ui";
import { IconRecord, IconSat, IconChevron } from "@/components/icons";
import { FollowButton } from "@/components/actions";
import { challengesForUser, feedForUser, suggestedAthletes, thisWeekStats, userActivities } from "@/lib/data";
import { formatDistance, formatDuration, formatNumber, pct } from "@/lib/format";
import { SPORTS } from "@/lib/sports";

export const dynamic = "force-dynamic";

const WEEK_GOAL_KM = 40;
const QUICK_SPORTS = ["run", "walk", "ride", "mtb", "hike"];

export default async function FeedPage() {
  const user = await requireUser();
  const [week, items, mine, challenges, suggestions] = await Promise.all([
    thisWeekStats(user.id),
    feedForUser(user.id, "following", 12),
    userActivities(user.id, user.id, { limit: 3 }),
    challengesForUser(user.id),
    suggestedAthletes(user.id, 3),
  ]);

  const activeChallenges = challenges.filter((c) => c.joined && !c.myCompletedAt).slice(0, 2);
  const goalMeters = WEEK_GOAL_KM * 1000;

  return (
    <AppShell user={user}>
      {/* Resumo da semana */}
      <section className="surface">
        <div className="flex items-start justify-between gap-3 px-4 pb-3.5 pt-4">
          <div>
            <p className="eyebrow">Esta semana</p>
            <p className="metric mt-2 text-[34px] font-black leading-none text-lime">{formatDistance(week.distanceM)}</p>
            <p className="tabular mt-2 text-[11px] text-muted">
              {formatDuration(week.movingSec, true)} · {Math.round(week.elevGainM)} m · {week.calories} kcal
            </p>
          </div>
          <div className="text-right">
            <p className="metric text-[15px] font-black">{formatNumber(week.count)}</p>
            <p className="text-[9px] font-display font-bold uppercase tracking-[0.14em] text-muted">treinos</p>
          </div>
        </div>
        <div className="px-4 pb-3.5">
          <div className="flex justify-between text-[10px] font-display font-bold uppercase tracking-[0.12em] text-muted">
            <span>Meta {WEEK_GOAL_KM} km</span>
            <span className="metric">
              {Math.round(week.distanceM / 1000)}/{WEEK_GOAL_KM}
            </span>
          </div>
          <div className="mt-2">
            <ProgressBar pct={pct(week.distanceM, goalMeters)} />
          </div>
        </div>
      </section>

      {/* Início rápido de atividade */}
      <section className="mt-6">
        <div className="mb-3 flex items-end justify-between">
          <h2 className="display-2 text-[15px]">Início rápido</h2>
          <Link href="/app/record" className="text-[10px] font-display font-bold uppercase tracking-[0.12em] text-lime">
            todas
          </Link>
        </div>
        <ul className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
          {QUICK_SPORTS.map((key) => {
            const sport = SPORTS[key];
            return (
              <li key={key} className="shrink-0">
                <Link
                  href={`/app/record/${key}`}
                  className="surface hover-lift flex w-[132px] flex-col gap-2 p-3.5"
                >
                  <span className="metric text-[10px] font-bold text-muted">{sport.usesPace ? "PACE" : "KM/H"}</span>
                  <span className="text-[13px] font-semibold leading-tight">{sport.label}</span>
                  <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-display font-bold uppercase tracking-[0.12em] text-lime">
                    Gravar <IconChevron className="size-2.5" />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Missões recomendadas */}
      {activeChallenges.length > 0 ? (
        <section className="mt-6">
          <div className="mb-3 flex items-end justify-between">
            <h2 className="display-2 text-[15px]">Missões em andamento</h2>
            <Link href="/app/missions" className="text-[10px] font-display font-bold uppercase tracking-[0.12em] text-lime">
              todas
            </Link>
          </div>
          <ul className="space-y-2">
            {activeChallenges.map((c) => (
              <li key={c.id}>
                <Link href={`/app/challenges/${c.id}`} className="surface hover-lift block p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="min-w-0 flex-1 truncate text-[13px] font-semibold">{c.name}</p>
                    <span className="metric shrink-0 text-[11px] font-bold text-muted">
                      {formatNumber(c.myProgress, c.unit === "km" ? 1 : 0)}/{formatNumber(c.target, c.unit === "km" ? 1 : 0)}
                    </span>
                  </div>
                  <div className="mt-2.5">
                    <ProgressBar pct={pct(c.myProgress, c.target)} color="#ff6a3d" />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Atividades recentes do atleta */}
      {mine.length > 0 ? (
        <section className="mt-6">
          <div className="mb-3 flex items-end justify-between">
            <h2 className="display-2 text-[15px]">Suas últimas</h2>
            <Link href="/app/activities" className="text-[10px] font-display font-bold uppercase tracking-[0.12em] text-lime">
              histórico
            </Link>
          </div>
          <ul className="divide-y divide-line border-y border-line">
            {mine.map((item) => (
              <li key={item.id}>
                <Link href={`/app/activities/${item.id}`} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold">{item.name}</p>
                    <p className="tabular truncate text-[11px] text-muted">
                      {formatDistance(item.distanceM)} · {formatDuration(item.movingSec, true)}
                      {item.route.length > 1 ? ` · ${item.gpsPoints} pts` : ""}
                    </p>
                  </div>
                  <IconChevron className="size-3 shrink-0 text-muted" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Feed dos amigos */}
      <section className="mt-6">
        <div className="mb-3 flex items-end justify-between">
          <h2 className="display-2 text-[15px]">Feed</h2>
          <Link href="/app?scope=global" className="text-[10px] font-display font-bold uppercase tracking-[0.12em] text-lime">
            global
          </Link>
        </div>
        <div className="space-y-3">
          {items.length === 0 ? (
            <div className="surface px-4 py-7 text-center">
              <p className="display-2 text-[14px]">Seu feed está vazio</p>
              <p className="mx-auto mt-2 max-w-[240px] text-[13px] text-muted">
                Siga atletas ou registre um treino para começar a ver atividades por aqui.
              </p>
              <Link href="/app/record" className="btn btn-primary mt-4">
                <IconRecord className="size-4" />
                Gravar atividade
              </Link>
            </div>
          ) : (
            items.map((item) => <ActivityCard key={item.id} item={item} showAuthor={item.user.id !== user.id} />)
          )}
        </div>
      </section>

      {/* Atletas para seguir */}
      {suggestions.length > 0 ? (
        <section className="mt-6">
          <h2 className="display-2 mb-3 text-[15px]">Atletas para seguir</h2>
          <ul className="divide-y divide-line border-y border-line">
            {suggestions.map((a) => (
              <li key={a.id} className="flex items-center gap-3 py-3">
                <Avatar name={a.name} color={a.avatarColor} size={36} href={`/app/athletes/${a.username}`} />
                <div className="min-w-0 flex-1">
                  <Link href={`/app/athletes/${a.username}`} className="truncate text-[13px] font-semibold">
                    {a.name}
                  </Link>
                  <p className="tabular truncate text-[11px] text-muted">
                    {formatNumber(a.activities)} treinos · {formatDistance(a.distanceM)}
                  </p>
                </div>
                <FollowButton userId={a.id} initialFollowing={false} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className="mt-8 flex items-center justify-center gap-1.5 text-[10px] text-muted">
        <IconSat className="size-3" /> GPS real · nenhum trajeto simulado
      </p>
    </AppShell>
  );
}
