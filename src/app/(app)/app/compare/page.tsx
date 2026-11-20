import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { activities, users } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { Card, EmptyState } from "@/components/ui";
import { computeSplits } from "@/lib/geo";
import { formatDistance, formatDuration, formatNumber, formatPace, formatSpeed } from "@/lib/format";
import { getSport, isRideSport } from "@/lib/sports";
import type { TrackPoint } from "@/db/schema";

export const dynamic = "force-dynamic";

export default async function ComparePage({ searchParams }: { searchParams: Promise<{ a?: string; b?: string }> }) {
  const user = await requireUser();
  const { a: rawA, b: rawB } = await searchParams;
  const rows = await db
    .select({
      id: activities.id,
      name: activities.name,
      sport: activities.sport,
      startedAt: activities.startedAt,
      distanceM: activities.distanceM,
      movingSec: activities.movingSec,
      elapsedSec: activities.elapsedSec,
      avgSpeedKmh: activities.avgSpeedKmh,
      maxSpeedKmh: activities.maxSpeedKmh,
      paceSecPerKm: activities.paceSecPerKm,
      elevGainM: activities.elevGainM,
      calories: activities.calories,
      track: activities.track,
      gpsPoints: activities.gpsPoints,
      authorName: users.name,
    })
    .from(activities)
    .innerJoin(users, eq(users.id, activities.userId))
    .where(and(eq(activities.userId, user.id), eq(activities.status, "published")))
    .orderBy(desc(activities.startedAt))
    .limit(40);

  const defaultA = rawA ? Number(rawA) : rows[0]?.id;
  const defaultB = rawB ? Number(rawB) : rows[1]?.id;
  const activityA = rows.find((r) => r.id === defaultA) ?? rows[0];
  const activityB = rows.find((r) => r.id === defaultB) ?? rows[1];

  return (
    <AppShell user={user} title="Comparar atividades" backHref="/app">
      <p className="text-[13px] text-muted">
        Compare dois pedais, corridas ou caminhadas lado a lado — distância, tempo, velocidade, altimetria e splits por km.
      </p>

      {rows.length < 2 ? (
        <div className="mt-4">
          <EmptyState
            emoji="⚖️"
            title="Faltam atividades para comparar"
            description="Registre pelo menos duas atividades para usar o comparador."
            cta="Gravar atividade"
            href="/app/record"
          />
        </div>
      ) : null}

      <form method="get" className="mt-4 grid grid-cols-[1fr_1fr_auto] gap-2">
        <select name="a" defaultValue={String(activityA?.id ?? "")} className="bg-ink px-3 py-2 text-xs hairline">
          {rows.map((r) => (
            <option key={`a-${r.id}`} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
        <select name="b" defaultValue={String(activityB?.id ?? "")} className="bg-ink px-3 py-2 text-xs hairline">
          {rows.map((r) => (
            <option key={`b-${r.id}`} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
        <button type="submit" className=" bg-lime px-4 py-2 text-[11px] font-display font-bold uppercase tracking-[0.12em] text-ink">
          Comparar
        </button>
      </form>

      {activityA && activityB && activityA.id !== activityB.id ? (
        <div className="mt-4 space-y-3">
          <Card className="p-4">
            <CompareRow
              label="Modalidade"
              a={`${getSport(activityA.sport).emoji} ${getSport(activityA.sport).label}`}
              b={`${getSport(activityB.sport).emoji} ${getSport(activityB.sport).label}`}
            />
            <CompareRow label="Data" a={new Date(activityA.startedAt).toLocaleDateString("pt-BR")} b={new Date(activityB.startedAt).toLocaleDateString("pt-BR")} />
            <CompareRow
              label="Distância"
              a={formatDistance(activityA.distanceM)}
              b={formatDistance(activityB.distanceM)}
              winner={activityA.distanceM > activityB.distanceM ? "a" : "b"}
            />
            <CompareRow
              label="Tempo em movimento"
              a={formatDuration(activityA.movingSec, true)}
              b={formatDuration(activityB.movingSec, true)}
              winner={activityA.movingSec < activityB.movingSec ? "a" : "b"}
            />
            {isRideSport(activityA.sport) || isRideSport(activityB.sport) ? (
              <>
                <CompareRow
                  label="Velocidade média"
                  a={`${formatSpeed(activityA.avgSpeedKmh)} km/h`}
                  b={`${formatSpeed(activityB.avgSpeedKmh)} km/h`}
                  winner={activityA.avgSpeedKmh > activityB.avgSpeedKmh ? "a" : "b"}
                />
                <CompareRow
                  label="Velocidade máxima"
                  a={`${formatSpeed(activityA.maxSpeedKmh)} km/h`}
                  b={`${formatSpeed(activityB.maxSpeedKmh)} km/h`}
                  winner={activityA.maxSpeedKmh > activityB.maxSpeedKmh ? "a" : "b"}
                />
              </>
            ) : (
              <CompareRow
                label="Pace médio"
                a={`${formatPace(activityA.paceSecPerKm)} /km`}
                b={`${formatPace(activityB.paceSecPerKm)} /km`}
                winner={activityA.paceSecPerKm < activityB.paceSecPerKm ? "a" : "b"}
              />
            )}
            <CompareRow
              label="Ganho de elevação"
              a={`${formatNumber(activityA.elevGainM)} m`}
              b={`${formatNumber(activityB.elevGainM)} m`}
              winner={activityA.elevGainM > activityB.elevGainM ? "a" : "b"}
            />
            <CompareRow
              label="Calorias"
              a={`${formatNumber(activityA.calories)} kcal`}
              b={`${formatNumber(activityB.calories)} kcal`}
              winner={activityA.calories > activityB.calories ? "a" : "b"}
            />
          </Card>

          <div className="grid grid-cols-2 gap-2">
            {[activityA, activityB].map((activity, i) => {
              const sport = getSport(activity.sport);
              const track = (activity.track ?? []) as TrackPoint[];
              const splits = computeSplits(track);
              const bestSplit = splits.reduce<number | null>(
                (best, s) => (best === null || s.seconds < best ? s.seconds : best),
                null,
              );
              return (
                <Card key={activity.id} className="p-3">
                  <p className="text-[11px] font-bold" style={{ color: sport.color }}>
                    {i === 0 ? "A" : "B"} · {activity.name}
                  </p>
                  <p className="tabular mt-1 text-[11px] text-muted">
                    {activity.gpsPoints} pontos GPS · {splits.length} splits
                  </p>
                  <p className="tabular mt-1 text-[11px] text-muted">
                    Melhor km: {bestSplit ? formatDuration(bestSplit) : "—"}
                  </p>
                  <Link href={`/app/activities/${activity.id}`} className="mt-2 block text-[11px] font-semibold text-lime">
                    abrir atividade
                  </Link>
                </Card>
              );
            })}
          </div>

          <p className="text-[11px] text-muted">
            Destaque em verde indica o melhor valor entre os dois treinos. A comparação usa os dados reais gravados por GPS.
          </p>
        </div>
      ) : null}
    </AppShell>
  );
}

function CompareRow({ label, a, b, winner }: { label: string; a: string; b: string; winner?: "a" | "b" }) {
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 border-b border-line py-2 last:border-0">
      <span className={`tabular text-right text-[14px] font-semibold ${winner === "a" ? "text-lime" : ""}`}>{a}</span>
      <span className="w-[130px] text-center text-[10px] font-semibold uppercase tracking-wider text-muted">{label}</span>
      <span className={`tabular text-left text-[14px] font-semibold ${winner === "b" ? "text-lime" : ""}`}>{b}</span>
    </div>
  );
}
