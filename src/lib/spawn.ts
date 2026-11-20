import { db } from "@/db";
import { activities, geoMissions, roadPoints, type BossChallenge, type GeoPoint } from "@/db/schema";
import { and, eq, gt, inArray, isNotNull, lt, ne, sql } from "drizzle-orm";
import { haversine } from "./format";
import { BOSS_STYLE } from "./emblems";

/* ───────── Vias públicas ───────── */
// Só vias transitáveis e públicas. Fora: autoestradas/vias expressas, acessos privados, entradas de garagem.
const ALLOWED = new Set(["residential", "living_street", "unclassified", "tertiary", "secondary", "tertiary_link", "secondary_link", "pedestrian", "cycleway", "footway", "path", "track", "service"]);
export type RoadEl = { type: string; id: number; geometry?: { lat: number; lon: number }[]; tags?: Record<string, string> };
type RoadPt = { lat: number; lng: number; name: string | null; highway: string; key: string };

const cellOf = (lat: number, lng: number) => `${Math.floor(lat / 0.01)}:${Math.floor(lng / 0.01)}`;
const isPublic = (t: Record<string, string> = {}) =>
  ALLOWED.has(t.highway ?? "") && !["private", "no", "customers", "delivery", "military"].includes(t.access ?? "") &&
  !(t.highway === "service" && ["driveway", "parking_aisle", "drive-through"].includes(t.service ?? "")) && t.area !== "yes" && t.foot !== "private";

export const OVERPASS_QUERY = (lat: number, lng: number, r: number) =>
  `[out:json][timeout:20];way(around:${r},${lat},${lng})[highway~"^(residential|living_street|unclassified|tertiary|secondary|tertiary_link|secondary_link|pedestrian|cycleway|footway|path|track|service)$"];out geom 400;`;

// Pontos sobre o eixo da via (vértices + pontos intermediários) — nunca fora da via
function roadPointsFrom(els: RoadEl[]): RoadPt[] {
  const out: RoadPt[] = [];
  for (const e of els) {
    if (e.type !== "way" || !e.geometry || e.geometry.length < 2 || !isPublic(e.tags)) continue;
    const g = e.geometry;
    for (let i = 0; i < g.length - 1; i++) {
      const a = { lat: g[i].lat, lng: g[i].lon }, b = { lat: g[i + 1].lat, lng: g[i + 1].lon };
      const seg = haversine(a, b);
      const steps = Math.max(1, Math.floor(seg / 120));
      for (let s = 0; s < steps; s++) {
        const f = (s + 0.5) / steps; // interpolação linear sobre o segmento da via
        out.push({ lat: a.lat + (b.lat - a.lat) * f, lng: a.lng + (b.lng - a.lng) * f, name: e.tags?.name ?? null, highway: e.tags!.highway, key: `${e.id}:${i}:${s}` });
      }
    }
  }
  return out;
}

export async function fetchRoadsServer(lat: number, lng: number, r: number): Promise<RoadEl[]> {
  for (const ep of ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"]) {
    try {
      const res = await fetch(ep, { method: "POST", body: "data=" + encodeURIComponent(OVERPASS_QUERY(lat, lng, r)), headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "MUV/1.0" }, signal: AbortSignal.timeout(9000) });
      if (res.ok) return (await res.json()).elements ?? [];
    } catch {}
  }
  return [];
}

async function cacheRoads(pts: RoadPt[]) {
  // amostra para não inflar o banco
  const sample = pts.filter((_, i) => i % 2 === 0).slice(0, 1500);
  for (let i = 0; i < sample.length; i += 300)
    await db.insert(roadPoints).values(sample.slice(i, i + 300).map((p) => ({ cell: cellOf(p.lat, p.lng), lat: p.lat, lng: p.lng, name: p.name, highway: p.highway, osmWay: p.key }))).onConflictDoNothing();
}

async function cachedRoads(lat: number, lng: number): Promise<RoadPt[]> {
  const cells: string[] = [];
  for (let dy = -5; dy <= 5; dy++) for (let dx = -5; dx <= 5; dx++) cells.push(cellOf(lat + dy * 0.01, lng + dx * 0.01));
  const rows = await db.select().from(roadPoints).where(inArray(roadPoints.cell, cells));
  return rows.map((r) => ({ lat: r.lat, lng: r.lng, name: r.name, highway: r.highway, key: r.osmWay }));
}

// Fallback final: pontos de trajetos que você já percorreu (vias comprovadamente transitáveis)
async function trackRoads(lat: number, lng: number): Promise<RoadPt[]> {
  const acts = await db.select({ id: activities.id, points: activities.points }).from(activities).where(eq(activities.integrity, "valid"));
  const out: RoadPt[] = [];
  for (const a of acts) (a.points ?? []).forEach((p, i) => { if (i % 6 === 0 && p.acc <= 25 && haversine({ lat, lng }, p) < 5500) out.push({ lat: p.lat, lng: p.lng, name: null, highway: "track_history", key: `act${a.id}:${i}` }); });
  return out;
}

/* ───────── Modelos: variedade + clássicos recorrentes ───────── */
type Kind = "exploration" | "chest" | "secret" | "collectible" | "route" | "photo";
const TIERS = {
  short: { min: 250, max: 1000, mult: 1, label: "Curto alcance" },
  medium: { min: 1000, max: 2500, mult: 1.9, label: "Médio alcance" },
  long: { min: 2500, max: 5000, mult: 3.2, label: "Longo alcance" },
} as const;
type Tier = keyof typeof TIERS;

const TEMPLATES: { key: string; kind: Kind; emblem: string; names: string[]; desc: string; xp: number; coins: number; item?: string; classic?: boolean; tiers: Tier[] }[] = [
  { key: "patrulha", kind: "exploration", emblem: "flag-bike-mountain", names: ["Patrulha do Bairro"], desc: "Clássico do MUV: alcance a bandeira e capture.", xp: 70, coins: 10, classic: true, tiers: ["short", "medium"] },
  { key: "bau", kind: "chest", emblem: "chest-gold", names: ["Baú da Esquina", "Baú Perdido", "Baú do Viajante"], desc: "Um baú de moedas sobre a via. Pare e capture.", xp: 50, coins: 45, classic: true, tiers: ["short", "medium", "long"] },
  { key: "alvo", kind: "exploration", emblem: "target-red", names: ["Alvo em Movimento", "Mira Certa", "Ponto de Impacto"], desc: "Chegue ao alvo marcado na rua.", xp: 80, coins: 12, tiers: ["short", "medium"] },
  { key: "pocao", kind: "collectible", emblem: "potion-lightning", names: ["Poção de Energia", "Frasco Relâmpago"], desc: "Recarga de energia esquecida no caminho.", xp: 60, coins: 15, item: "potion-lightning", tiers: ["short", "medium", "long"] },
  { key: "cristal", kind: "secret", emblem: "crystal-purple", names: ["Cristal Oculto", "Fragmento Roxo", "Veio de Cristal"], desc: "Cristal raro. Só se revela a menos de 300 m.", xp: 140, coins: 30, item: "crystal-purple", tiers: ["medium", "long"] },
  { key: "medalha", kind: "collectible", emblem: "medal-bike", names: ["Medalha do Pedal", "Honra do Ciclista"], desc: "Uma medalha espera quem for longe.", xp: 160, coins: 35, item: "medal-bike", tiers: ["medium", "long"] },
  { key: "trofeu", kind: "collectible", emblem: "trophy-gold", names: ["Troféu da Estrada", "Taça do Explorador"], desc: "Recompensa lendária para longas distâncias.", xp: 260, coins: 70, item: "trophy-gold", tiers: ["long"] },
  { key: "registro", kind: "photo", emblem: "compass", names: ["Registro da Estrada", "Diário da Rua"], desc: "Clássico do MUV: chegue ao ponto e registre uma foto real pelo app.", xp: 90, coins: 15, classic: true, tiers: ["short", "medium"] },
  { key: "ponto-vista", kind: "photo", emblem: "mountain-route-pin", names: ["Ponto de Vista", "Olhar do Explorador"], desc: "Fotografe a paisagem deste ponto da via.", xp: 120, coins: 20, tiers: ["medium", "long"] },
  { key: "bau-foto", kind: "photo", emblem: "chest-gold", names: ["Baú Fotográfico"], desc: "O baú só abre com uma foto tirada no local.", xp: 80, coins: 50, tiers: ["short", "medium", "long"] },
  { key: "sprint", kind: "route", emblem: "flag-checkered-flame", names: ["Sprint da Via", "Linha de Chegada"], desc: "Clássico do MUV: passe pelos checkpoints na ordem, gravando a atividade.", xp: 180, coins: 30, classic: true, tiers: ["short", "medium"] },
  { key: "subida", kind: "route", emblem: "mountain-route-pin", names: ["Rota da Serra", "Escalada Urbana"], desc: "Percurso por vias públicas com pontos de controle. Validado pelo GPS gravado.", xp: 240, coins: 40, item: "badge-mtb-trail", tiers: ["medium", "long"] },
  { key: "trilha", kind: "route", emblem: "badge-mtb-trail", names: ["Trilha do Desbravador", "Caminho de Terra"], desc: "Trecho por caminho/trilha pública. Confira condições no local.", xp: 260, coins: 45, item: "badge-mtb-trail", tiers: ["medium", "long"] },
];
const EASY_BOSSES = [
  { name: "Golem da Rua", desc: "Boss comum. Alcance o covil e complete 2 km em uma atividade." },
  { name: "Sentinela de Pedra", desc: "Boss comum. Presença no local + 2 km gravados derrotam a sentinela." },
  { name: "Guardião da Praça", desc: "Boss comum e recorrente. Ótimo para começar." },
];
const SPECIAL_BOSSES = [
  { name: "Titã — Guardião da Montanha", category: "climb", emblem: "boss-golem" },
  { name: "Colosso de Gelo", category: "endurance", emblem: "boss-golem" },
  { name: "Portal do Abismo", category: "legendary", emblem: "portal-blue" },
  { name: "Lorde Lendário", category: "legendary", emblem: "boss-golem" },
];
export const SPECIAL_UNLOCK = 3; // missões concluídas para invocar um Boss Especial

const rand = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const endOfDay = () => { const d = new Date(); d.setHours(23, 59, 0, 0); return d; };

function homeGuess(acts: { points: { lat: number; lng: number }[] }[]) {
  const c = new Map<string, number>();
  for (const a of acts) { const p = a.points?.[0]; if (p) { const k = `${Math.round(p.lat / 0.002)}:${Math.round(p.lng / 0.002)}`; c.set(k, (c.get(k) ?? 0) + 1); } }
  const best = [...c.entries()].sort((a, b) => b[1] - a[1])[0];
  if (!best || best[1] < 2) return null;
  const [y, x] = best[0].split(":").map(Number);
  return { lat: y * 0.002, lng: x * 0.002 };
}

/* ───────── Ciclo: expirar → repor ───────── */
export async function spawnAround(origin: { lat: number; lng: number }, clientRoads: RoadEl[], userLevel: number) {
  // 1) rotação: missões vencidas saem do mapa
  await db.update(geoMissions).set({ status: "expired" }).where(and(isNotNull(geoMissions.expiresAt), lt(geoMissions.expiresAt, new Date()), ne(geoMissions.status, "completed")));

  // 2) vias públicas: cliente → servidor (Overpass) → cache → trajetos já percorridos
  let source = "osm-client";
  let roads = roadPointsFrom(clientRoads);
  if (roads.length < 20) { roads = roadPointsFrom(await fetchRoadsServer(origin.lat, origin.lng, 5000)); source = "osm-server"; }
  if (roads.length >= 20) await cacheRoads(roads);
  else { roads = await cachedRoads(origin.lat, origin.lng); source = "cache"; }
  if (roads.length < 10) { roads = [...roads, ...(await trackRoads(origin.lat, origin.lng))]; source = roads.length ? "history" : "none"; }
  if (!roads.length) return { created: 0, source, reason: "Sem dados confiáveis de vias públicas nesta área." };

  const acts = await db.select({ points: activities.points }).from(activities);
  const home = homeGuess(acts);
  const live = await db.select().from(geoMissions).where(inArray(geoMissions.status, ["available", "unlocked", "in_progress", "paused"]));
  const nearLive = live.filter((m) => m.lat != null && haversine(origin, { lat: m.lat!, lng: m.lng! }) < 5500);
  const taken: { lat: number; lng: number }[] = nearLive.map((m) => ({ lat: m.lat!, lng: m.lng! }));
  const withDist = roads.map((p) => ({ ...p, d: haversine(origin, p) })).filter((p) => p.d > 150 && (!home || haversine(home, p) > 250));

  const pickPoint = (tier: Tier, spacing = 220) => {
    const t = TIERS[tier];
    const cands = withDist.filter((p) => p.d >= t.min && p.d <= t.max && taken.every((q) => haversine(q, p) > spacing));
    if (!cands.length) return null;
    const p = rand(cands); taken.push(p); return p;
  };
  const lvlMult = 1 + Math.min(userLevel, 20) * 0.05;
  const out: (typeof geoMissions.$inferInsert)[] = [];
  const countTier = (tier: Tier) => nearLive.filter((m) => m.tier === tier && m.type !== "boss").length + out.filter((m) => m.tier === tier && m.type !== "boss").length;
  const hasTemplateNear = (k: string) => nearLive.some((m) => m.template === k) || out.some((m) => m.template === k);

  // 3) desafios por alcance — quanto mais longe, maior a recompensa
  const TARGET: Record<Tier, number> = { short: 5, medium: 4, long: 3 };
  for (const tier of ["short", "medium", "long"] as Tier[]) {
    let guard = 0;
    while (countTier(tier) < TARGET[tier] && guard++ < 12) {
      const pool = TEMPLATES.filter((t) => t.tiers.includes(tier));
      // consistência: clássicos sempre presentes; variedade: demais sorteados sem repetir na área
      const missingClassic = pool.find((t) => t.classic && !hasTemplateNear(t.key));
      const tpl = missingClassic ?? rand(pool.filter((t) => !hasTemplateNear(t.key)).concat(pool.filter((t) => t.classic)));
      const p = pickPoint(tier);
      if (!p) break;
      const m = TIERS[tier].mult * lvlMult;
      const where = p.name ? ` — ${p.name}` : "";
      if (tpl.kind === "route") {
        // percurso ao longo de vias: 3 checkpoints em pontos reais de vias próximas entre si
        const cps = [p, ...withDist.filter((q) => q !== p && haversine(q, p) > 250 && haversine(q, p) < (tier === "short" ? 900 : 1800)).sort(() => Math.random() - 0.5).slice(0, 2)];
        if (cps.length < 3) continue;
        cps.splice(1, 2, ...cps.slice(1).sort((a, b) => haversine(p, a) - haversine(p, b))); // início no ponto sorteado do alcance
        const dist = haversine(cps[0], cps[1]) + haversine(cps[1], cps[2]);
        out.push({ type: "route", tier, template: tpl.key, title: `${rand(tpl.names)}${where}`, description: `${tpl.desc} Checkpoints sobre vias públicas; o caminho entre eles é livre — escolha ruas seguras.`, emblem: tpl.emblem, lat: cps[0].lat, lng: cps[0].lng, radiusM: 35, difficulty: tier === "short" ? 1 : tier === "medium" ? 2 : 3, xp: Math.round(tpl.xp * m), coins: Math.round(tpl.coins * m), item: tier !== "short" ? tpl.item ?? null : null, req: { checkpoints: cps.map((c, i): GeoPoint => ({ lat: c.lat, lng: c.lng, name: c.name ?? `Checkpoint ${i + 1}` })), distanceM: dist }, verified: false, osmRef: `road/${p.key}`, expiresAt: new Date(Date.now() + 3 * 864e5) });
      } else {
        const longItem = tier === "long" && !tpl.item ? rand(["chest-gold", "crystal-purple", "potion-lightning"]) : tpl.item ?? null;
        out.push({ type: tpl.kind, tier, template: tpl.key, title: `${rand(tpl.names)}${where}`, description: `${tpl.desc} ${TIERS[tier].label}: recompensa ×${TIERS[tier].mult}.`, emblem: tpl.emblem, lat: p.lat, lng: p.lng, radiusM: tpl.kind === "photo" ? 80 : 30, difficulty: tier === "short" ? 1 : tier === "medium" ? 2 : 3, xp: Math.round(tpl.xp * m), coins: Math.round(tpl.coins * m), item: longItem, verified: true, osmRef: `road/${p.key}`, expiresAt: new Date(Date.now() + (tier === "short" ? 1 : 2) * 864e5) });
      }
    }
  }

  // 4) Bosses fáceis: sempre 1–2 na região
  const easyNear = nearLive.filter((m) => m.type === "boss" && m.category === "easy").length;
  for (let i = easyNear; i < 2; i++) {
    const p = pickPoint(i === 0 ? "short" : "medium", 400) ?? pickPoint("medium", 400);
    if (!p) break;
    const b = rand(EASY_BOSSES);
    const challenges: BossChallenge[] = [{ kind: "reach", label: "Alcançar o covil", value: 0, damage: 50, done: false }, { kind: "distance", label: "Completar 2 km em uma atividade", value: 2000, damage: 50, done: false }];
    out.push({ type: "boss", category: "easy", tier: i === 0 ? "short" : "medium", template: "boss-easy", title: b.name, description: b.desc, emblem: "boss-golem", lat: p.lat, lng: p.lng, radiusM: 45, difficulty: 1, xp: Math.round(250 * lvlMult), coins: 60, item: "helmet-cycling-blue", hp: 100, hpMax: 100, req: { challenges }, verified: true, osmRef: `road/${p.key}`, expiresAt: new Date(Date.now() + 3 * 864e5) });
  }

  // 5) Boss Especial: invocado após SPECIAL_UNLOCK missões concluídas, por tempo limitado
  const special = await specialStatus();
  if (special.ready) {
    const p = pickPoint("medium", 400) ?? pickPoint("long", 400) ?? pickPoint("short", 400);
    if (p) {
      const s = rand(SPECIAL_BOSSES);
      const k = 1 + Math.floor(userLevel / 5);
      const challenges: BossChallenge[] = [
        { kind: "reach", label: "Alcançar o covil antes do tempo acabar", value: 0, damage: 40, done: false },
        { kind: "distance", label: `Completar ${6 * k} km em uma atividade`, value: 6000 * k, damage: 40, done: false },
        { kind: "climb", label: `Acumular ${60 * k} m de subida em uma atividade`, value: 60 * k, damage: 40, done: false },
      ];
      const exp = new Date(Math.max(Date.now() + 2 * 3600e3, Math.min(Date.now() + 6 * 3600e3, endOfDay().getTime())));
      out.push({ type: "boss", category: s.category === "legendary" ? "legendary" : s.category, tier: "medium", template: "boss-special", title: s.name || BOSS_STYLE[s.category].name, description: "Boss Especial invocado pelas suas conquistas recentes. Recompensas raras — mas ele desaparece quando o tempo acabar.", emblem: s.emblem, lat: p.lat, lng: p.lng, radiusM: 50, difficulty: 4, xp: Math.round(1500 * lvlMult), coins: 400, item: rand(["trophy-gold", "shield-star-laurel", "crystal-purple"]), hp: 120, hpMax: 120, req: { challenges }, verified: true, osmRef: `special/${Date.now()}`, expiresAt: exp, status: "unlocked" });
    }
  }

  if (out.length) await db.insert(geoMissions).values(out);
  return { created: out.length, source, roads: roads.length, special: await specialStatus() };
}

// Progresso para o próximo Boss Especial
export async function specialStatus() {
  const [last] = await db.select({ at: sql<Date | null>`max(${geoMissions.createdAt})` }).from(geoMissions).where(eq(geoMissions.template, "boss-special"));
  const [active] = await db.select({ n: sql<number>`count(*)::int` }).from(geoMissions).where(and(eq(geoMissions.template, "boss-special"), inArray(geoMissions.status, ["unlocked", "in_progress", "paused"]), gt(geoMissions.expiresAt, new Date())));
  const since = last?.at ? new Date(last.at) : new Date(0);
  const [done] = await db.select({ n: sql<number>`count(*)::int` }).from(geoMissions).where(and(eq(geoMissions.status, "completed"), ne(geoMissions.type, "boss"), gt(geoMissions.completedAt, since)));
  const count = Math.min(SPECIAL_UNLOCK, done?.n ?? 0);
  return { count, need: SPECIAL_UNLOCK, active: (active?.n ?? 0) > 0, ready: (active?.n ?? 0) === 0 && count >= SPECIAL_UNLOCK };
}
