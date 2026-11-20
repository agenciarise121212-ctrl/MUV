import Link from "next/link";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { segments } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { Card, Pill } from "@/components/ui";
import { Avatar } from "@/components/Avatar";
import MapCanvas from "@/components/MapCanvas";
import { segmentLeaderboard } from "@/lib/data";
import { formatDistance, formatDuration, formatSpeed } from "@/lib/format";
import { getSport, isRideSport } from "@/lib/sports";

export const dynamic = "force-dynamic";

export default async function SegmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isInteger(id)) notFound();

  const rows = await db.select().from(segments).where(eq(segments.id, id)).limit(1);
  const segment = rows[0];
  if (!segment) notFound();

  const board = await segmentLeaderboard(id, 30);
  const sport = getSport(segment.sport);
  const path = (segment.path ?? []) as { lat: number; lng: number }[];
  const coords = path.map((p) => [p.lng, p.lat] as [number, number]);
  const myBest = board.find((b) => b.userId === user.id);

  return (
    <AppShell user={user} title={segment.name} backHref="/app/segments">
      <div className="overflow-hidden rounded-2xl hairline">
        <div className="relative h-[260px]">
          <MapCanvas className="absolute inset-0" lines={[{ coords, color: sport.color, width: 6 }]} autoFit />
        </div>
      </div>

      <Card className="mt-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-base font-black">{segment.name}</p>
            <p className="text-[12px] text-muted">
              {sport.emoji} {sport.label} · {segment.city}
            </p>
          </div>
          {myBest ? <Pill tone="lime">seu melhor {formatDuration(myBest.elapsedSec)}</Pill> : null}
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="tabular text-lg font-black" style={{ color: sport.color }}>{formatDistance(segment.distanceM)}</p>
            <p className="text-[10px] uppercase tracking-wider text-muted">distância</p>
          </div>
          <div>
            <p className="tabular text-lg font-black">{segment.avgGradePct.toFixed(1)}%</p>
            <p className="text-[10px] uppercase tracking-wider text-muted">inclinação</p>
          </div>
          <div>
            <p className="tabular text-lg font-black">{board.length}</p>
            <p className="text-[10px] uppercase tracking-wider text-muted">esforços</p>
          </div>
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-muted">
          {isRideSport(segment.sport)
            ? "Um pedal inicia próximo à largada e termina perto da chegada para registrar o esforço."
            : "Uma corrida ou caminhada iniciando próximo à largada registra o esforço automaticamente."}
        </p>
      </Card>

      <section className="mt-6">
        <h2 className="mb-2 text-[14px] font-semibold">Ranking</h2>
        <Card className="divide-y divide-line">
          {board.length === 0 ? (
            <p className="px-4 py-4 text-[13px] text-muted">Nenhum esforço registrado. Grave um treino neste trecho!</p>
          ) : (
            board.map((row, index) => (
              <div key={row.id} className="flex items-center gap-3 px-4 py-3">
                <span className={`tabular w-6 text-sm font-black ${index === 0 ? "text-amber-300" : "text-muted"}`}>{index + 1}</span>
                <Avatar name={row.name} color={row.avatarColor} size={34} href={`/app/athletes/${row.username}`} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-semibold">{row.name}</p>
                  <p className="text-[11px] text-muted">
                    {formatSpeed(row.avgSpeedKmh)} km/h ·{" "}
                    <Link href={`/app/activities/${row.activityId}`} className="text-lime">
                      ver atividade
                    </Link>
                  </p>
                </div>
                <p className="tabular text-[14px] font-semibold text-lime">{formatDuration(row.elapsedSec)}</p>
              </div>
            ))
          )}
        </Card>
      </section>
    </AppShell>
  );
}
