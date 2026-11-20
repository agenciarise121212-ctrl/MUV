import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { ActivityCard } from "@/components/ActivityCard";
import { Card, EmptyState, ProgressBar } from "@/components/ui";
import { userActivities, weeklyVolume } from "@/lib/data";
import { formatDistance, formatDuration, formatNumber } from "@/lib/format";
import { SPORTS } from "@/lib/sports";

export const dynamic = "force-dynamic";

const FILTERS = [
  { key: "all", label: "Todas" },
  { key: "ride", label: "🚴 Pedal" },
  { key: "run", label: "🏃 Corrida" },
  { key: "walk", label: "🚶 Caminhada" },
];

export default async function ActivitiesPage({ searchParams }: { searchParams: Promise<{ filter?: string; sport?: string }> }) {
  const user = await requireUser();
  const { filter: rawFilter, sport: rawSport } = await searchParams;
  const filter = FILTERS.find((f) => f.key === rawFilter)?.key ?? "all";
  const items = await userActivities(user.id, user.id, { sport: rawSport, category: filter === "all" ? undefined : filter, limit: 60 });
  const volume = await weeklyVolume(user.id, 8);
  const maxDistance = Math.max(1, ...volume.map((v) => v.distanceM));

  const totals = items.reduce(
    (acc, item) => {
      acc.distanceM += item.distanceM;
      acc.movingSec += item.movingSec;
      acc.elevGainM += item.elevGainM;
      acc.calories += item.calories;
      return acc;
    },
    { distanceM: 0, movingSec: 0, elevGainM: 0, calories: 0 },
  );

  return (
    <AppShell user={user} title="Minhas atividades" backHref="/app">
      <Card className="p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Últimas {items.length} atividades</p>
        <div className="mt-3 grid grid-cols-4 gap-2 text-center">
          <Stat label="Distância" value={formatDistance(totals.distanceM)} />
          <Stat label="Tempo" value={formatDuration(totals.movingSec, true)} />
          <Stat label="Ganho" value={`${formatNumber(totals.elevGainM)} m`} />
          <Stat label="Calorias" value={formatNumber(totals.calories)} />
        </div>
      </Card>

      <section className="mt-5">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Volume semanal</p>
        <Card className="p-4">
          <div className="flex h-28 items-end gap-1.5">
            {volume.length === 0 ? (
              <p className="text-[12px] text-muted">Sem dados suficientes ainda.</p>
            ) : (
              volume.map((v) => (
                <div key={v.week} className="flex flex-1 flex-col items-center gap-1">
                  <div
                    className="w-full rounded-t-md bg-lime/80"
                    style={{ height: `${Math.max(4, (v.distanceM / maxDistance) * 90)}px` }}
                    title={`${formatDistance(v.distanceM)}`}
                  />
                  <span className="text-[9px] text-muted">{v.week.slice(8)}</span>
                </div>
              ))
            )}
          </div>
          <div className="mt-3">
            <ProgressBar pct={Math.min(100, (items.length / 10) * 100)} color="#ff7a3d" />
            <p className="mt-1 text-[11px] text-muted">
              {formatNumber(volume.reduce((s, v) => s + v.count, 0))} atividades nas últimas 8 semanas
            </p>
          </div>
        </Card>
      </section>

      <div className="no-scrollbar mt-5 -mx-4 flex gap-2 overflow-x-auto px-4">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={f.key === "all" ? "/app/activities" : `/app/activities?filter=${f.key}`}
            className={`shrink-0 rounded-full px-4 py-2 text-[11px] font-display font-bold uppercase tracking-[0.12em] ${filter === f.key ? "bg-lime text-ink" : "bg-surface text-muted hairline"}`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      <div className="no-scrollbar mt-2 -mx-4 flex gap-2 overflow-x-auto px-4">
        {Object.values(SPORTS)
          .filter((s) => s.available)
          .map((s) => (
            <Link
              key={s.key}
              href={`/app/activities?sport=${s.key}`}
              className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-semibold ${rawSport === s.key ? "bg-surface-3 text-lime hairline" : "text-muted"}`}
            >
              {s.emoji} {s.label}
            </Link>
          ))}
        {rawSport ? (
          <Link href="/app/activities" className="shrink-0 rounded-full bg-flame/15 px-3 py-1.5 text-[11px] font-semibold text-flame">
            limpar
          </Link>
        ) : null}
      </div>

      <div className="mt-4 space-y-4">
        {items.length === 0 ? (
          <EmptyState
            emoji="📋"
            title="Nada por aqui ainda"
            description="Grave uma corrida, caminhada ou pedal para construir seu histórico com splits, fotos e recordes."
            cta="Gravar atividade"
            href="/app/record"
          />
        ) : (
          items.map((item) => <ActivityCard key={item.id} item={item} showAuthor={false} />)
        )}
      </div>

      <Link href="/app/compare" className="mt-6 block surface block p-4 text-center text-[13px] font-display font-bold uppercase tracking-[0.12em] text-lime">
        ⚖️ Comparar atividades
      </Link>
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">{label}</p>
      <p className="tabular text-[14px] font-semibold">{value}</p>
    </div>
  );
}
