import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { Card, Pill } from "@/components/ui";
import { segmentsWithStats } from "@/lib/data";
import { formatDistance, formatDuration, formatSpeed } from "@/lib/format";
import { getSport } from "@/lib/sports";

export const dynamic = "force-dynamic";

export default async function SegmentsPage() {
  const user = await requireUser();
  const segments = await segmentsWithStats(user.id);

  return (
    <AppShell user={user} title="Segmentos" backHref="/app">
      <p className="text-[13px] text-muted">
        Trechos clássicos de pedal e corrida. Cada atividade publicada é comparada automaticamente aos segmentos compatíveis e o
        tempo entra no ranking.
      </p>

      <div className="mt-4 space-y-2">
        {segments.length === 0 ? (
          <Card className="p-4 text-[13px] text-muted">Nenhum segmento cadastrado ainda.</Card>
        ) : (
          segments.map((s) => {
            const sport = getSport(s.segment.sport);
            return (
              <Link key={s.segment.id} href={`/app/segments/${s.segment.id}`} className="block">
                <Card className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[14px] font-semibold">{s.segment.name}</p>
                      <p className="text-[11px] text-muted">
                        {sport.emoji} {sport.label} · {s.segment.city}
                      </p>
                    </div>
                    {s.myBest > 0 ? <Pill tone="lime">seu melhor {formatDuration(s.myBest)}</Pill> : <Pill>sem esforço</Pill>}
                  </div>
                  <div className="mt-3 grid grid-cols-4 gap-2 text-center">
                    <Mini label="Distância" value={formatDistance(s.segment.distanceM)} />
                    <Mini label="Inclinação" value={`${s.segment.avgGradePct.toFixed(1)}%`} />
                    <Mini label="Atletas" value={String(s.athletes)} />
                    <Mini label="Recorde" value={s.bestTime ? formatDuration(s.bestTime) : "—"} />
                  </div>
                </Card>
              </Link>
            );
          })
        )}
      </div>
    </AppShell>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted">{label}</p>
      <p className="tabular text-[13px] font-bold">{value}</p>
    </div>
  );
}
