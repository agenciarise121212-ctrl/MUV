import { listActivities, simplify } from "@/lib/queries";
import { getSport } from "@/lib/sports";
import MapExplorer, { type MapAct, type MapMission } from "./MapExplorer";
import { listMissions, wallet } from "@/lib/rpg";
import { specialStatus } from "@/lib/spawn";

export const dynamic = "force-dynamic";

export default async function MapPage() {
  const all = await listActivities();
  const acts: MapAct[] = all.filter((a) => a.points.length > 1).map((a) => ({
    id: a.id, title: a.title, sport: a.sport, group: getSport(a.sport).group, label: getSport(a.sport).label, distanceM: a.distanceM, movingSec: a.movingSec,
    avgSpeed: a.avgSpeed, elevGainM: a.elevGainM, startedAt: a.startedAt.toISOString(), photo: a.photos[0]?.id ?? null,
    points: simplify(a.points, 300).map((p) => [p.lat, p.lng] as [number, number]),
  }));
  // Territórios: células de 0.005° visitadas (mesma regra da gamificação)
  const cells = new Map<string, number>();
  for (const a of all.filter((x) => x.integrity !== "suspect")) for (const p of a.points ?? []) { const k = `${Math.floor(p.lat / 0.005)}:${Math.floor(p.lng / 0.005)}`; cells.set(k, (cells.get(k) ?? 0) + 1); }
  const territories = [...cells.keys()].map((k) => k.split(":").map(Number) as [number, number]);
  const missions: MapMission[] = (await listMissions()).map((m) => ({ id: m.id, type: m.type, category: m.category, title: m.title, description: m.description, emblem: m.emblem, lat: m.lat, lng: m.lng, radiusM: m.radiusM, difficulty: m.difficulty, xp: m.xp, coins: m.coins, item: m.item, status: m.status, req: m.req, progress: m.progress, hp: m.hp, hpMax: m.hpMax, verified: m.verified, tier: m.tier, template: m.template, expiresAt: m.expiresAt?.toISOString() ?? null }));
  const special = await specialStatus();
  const w = await wallet();
  return <MapExplorer acts={acts} territories={territories} missions={missions} wallet={{ xp: w.xp, coins: w.coins }} special={special} />;
}
