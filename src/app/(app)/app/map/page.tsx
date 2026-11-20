import { requireUser } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { MapExplorer, type MapSegment, type MapTerritory } from "@/components/MapExplorer";
import { segmentsWithStats, territoriesForUser } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function MapPage() {
  const user = await requireUser();
  const [territories, segments] = await Promise.all([territoriesForUser(user.id), segmentsWithStats(user.id)]);

  const mappedTerritories: MapTerritory[] = territories.map((t) => ({
    id: t.id,
    name: t.name,
    region: t.region,
    emoji: t.emoji,
    description: t.description,
    centerLat: t.centerLat,
    centerLng: t.centerLng,
    radiusM: t.radiusM,
    xpReward: t.xpReward,
    coinsReward: t.coinsReward,
    claimed: t.claimed,
    owners: t.owners,
    lastOwner: t.lastOwner,
    myDistanceInsideM: t.myDistanceInsideM,
  }));

  const mappedSegments: MapSegment[] = segments.map((s) => ({
    id: s.segment.id,
    name: s.segment.name,
    sport: s.segment.sport,
    city: s.segment.city,
    distanceM: s.segment.distanceM,
    avgGradePct: s.segment.avgGradePct,
    startLat: s.segment.startLat,
    startLng: s.segment.startLng,
    endLat: s.segment.endLat,
    endLng: s.segment.endLng,
    athletes: s.athletes,
    bestTime: s.bestTime,
    myBest: s.myBest,
  }));

  return (
    <AppShell
      user={user}
      title="Mapa"
      subtitle="Territórios, segmentos e sua posição"
      right={<span className="metric hidden border border-line px-2 py-1 text-[11px] font-bold text-lime">{territories.filter((t) => t.claimed).length}/{territories.length}</span>}
    >
      <MapExplorer territories={mappedTerritories} segments={mappedSegments} />
    </AppShell>
  );
}
