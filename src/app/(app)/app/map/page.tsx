import { requireUser } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { QuestMap } from "@/components/QuestMap";
import { segmentsWithStats, territoriesForUser } from "@/lib/data";
import { loadQuestBoard } from "@/lib/quests";
import type { MapCircle, MapLine } from "@/components/MapCanvas";

export const dynamic = "force-dynamic";

export default async function MapPage() {
  const user = await requireUser();
  const [board, territories, segments] = await Promise.all([
    loadQuestBoard(user.id, null),
    territoriesForUser(user.id),
    segmentsWithStats(user.id),
  ]);

  const territoryCircles: MapCircle[] = territories.map((t) => ({
    center: [t.centerLng, t.centerLat] as [number, number],
    radiusM: t.radiusM,
    color: t.claimed ? "#d5ff45" : "#6fb6ff",
  }));

  const territoryLines: MapLine[] = [];
  const segmentLines: MapLine[] = segments.map((s) => ({
    coords: [
      [s.segment.startLng, s.segment.startLat],
      [s.segment.endLng, s.segment.endLat],
    ],
    color: "#ff6a3d",
    width: 3,
  }));

  return (
    <AppShell
      user={user}
      title="Exploração"
      subtitle="Missões, baús e bosses no território real"
      right={
        <span className="metric hidden border border-line px-2 py-1 text-[11px] font-bold text-lime">
          {board.quests.filter((q) => q.state === "completed").length}/{board.quests.length}
        </span>
      }
    >
      <QuestMap
        initialQuests={board.quests}
        territories={territoryCircles}
        territoryLines={territoryLines}
        segmentLines={segmentLines}
        ownedTerritories={territories.filter((t) => t.claimed).length}
        totalTerritories={territories.length}
      />
    </AppShell>
  );
}
