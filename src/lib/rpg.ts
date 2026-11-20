import { db } from "@/db";
import { activities, geoMissions, rewardLedger, type BossChallenge, type GeoPoint, type MissionReq, type TrackPoint } from "@/db/schema";
import { desc, eq, inArray, ne, sql } from "drizzle-orm";
import { haversine } from "./format";
import { BOSS_STYLE, TYPE_EMBLEM } from "./emblems";

export type Mission = typeof geoMissions.$inferSelect;
const GEO_TYPES = ["exploration", "chest", "collectible", "secret", "climb"];

/* ───────── Recompensas (idempotentes) ───────── */
export async function award(source: string, r: { xp: number; coins: number; item?: string | null; label: string }) {
  const rows = await db.insert(rewardLedger).values({ source, xp: r.xp, coins: r.coins, item: r.item ?? null, label: r.label }).onConflictDoNothing({ target: rewardLedger.source }).returning({ id: rewardLedger.id });
  return rows.length > 0;
}

export async function wallet() {
  const [t] = await db.select({ xp: sql<number>`coalesce(sum(${rewardLedger.xp}),0)::int`, coins: sql<number>`coalesce(sum(${rewardLedger.coins}),0)::int` }).from(rewardLedger);
  const items = await db.select({ item: rewardLedger.item, label: rewardLedger.label, createdAt: rewardLedger.createdAt }).from(rewardLedger).where(sql`${rewardLedger.item} is not null`).orderBy(desc(rewardLedger.createdAt));
  const inv = new Map<string, number>();
  for (const i of items) inv.set(i.item!, (inv.get(i.item!) ?? 0) + 1);
  const recent = await db.select().from(rewardLedger).orderBy(desc(rewardLedger.createdAt)).limit(20);
  return { xp: t?.xp ?? 0, coins: t?.coins ?? 0, inventory: [...inv.entries()].map(([item, qty]) => ({ item, qty })), recent };
}

async function complete(m: Mission, reason: string) {
  await db.update(geoMissions).set({ status: "completed", completedAt: new Date(), hp: m.hpMax != null ? 0 : m.hp }).where(eq(geoMissions.id, m.id));
  const fresh = await award(`mission:${m.id}`, { xp: m.xp, coins: m.coins, item: m.item, label: `${m.title} — ${reason}` });
  return { completed: true, rewarded: fresh, xp: m.xp, coins: m.coins, item: m.item };
}

/* ───────── Captura por proximidade (GPS ao vivo) ───────── */
export async function capture(id: number, p: { lat: number; lng: number; acc: number; speed: number | null; radius?: number }) {
  const [m] = await db.select().from(geoMissions).where(eq(geoMissions.id, id));
  if (!m || m.lat == null || m.lng == null) return { error: "Missão não encontrada ou sem localização." };
  if (m.status === "completed") return { error: "Missão já concluída." };
  if (m.status === "paused") return { error: "Missão pausada. Retome para interagir." };
  if (m.status === "expired" || (m.expiresAt && m.expiresAt < new Date())) return { error: "O tempo desta missão acabou." };
  if (!isFinite(p.lat) || !isFinite(p.lng) || !isFinite(p.acc)) return { error: "Coordenadas inválidas." };
  if (p.acc > 50) return { error: `Precisão do GPS insuficiente (±${Math.round(p.acc)} m). Aguarde um sinal melhor.` };
  if (p.speed != null && p.speed > 2.5) return { error: "Pare em local seguro para interagir." };
  const userRadius = Math.min(80, Math.max(20, p.radius ?? 35));
  const limit = Math.max(m.radiusM, userRadius) + Math.min(p.acc, 25);
  const d = haversine({ lat: m.lat, lng: m.lng }, p);
  if (d > limit) return { error: `Você está a ${Math.round(d)} m. Aproxime-se até ${Math.round(limit)} m.`, distance: d };

  if (m.type === "boss") {
    const ch = (m.req.challenges ?? []).map((c) => ({ ...c }));
    const idx = ch.findIndex((c) => c.kind === "reach" && !c.done);
    if (idx < 0) return { error: "Você já marcou presença. Complete os outros desafios em atividades gravadas." };
    return applyBoss(m, ch, [idx], "presença no local");
  }
  if (m.type === "photo") return { error: "Este desafio é concluído com uma foto tirada no local." };
  if (m.type === "route" || m.type === "trail") return { error: "Percursos são validados pelo trajeto gravado. Inicie a missão e grave a atividade." };
  return complete(m, "capturada no local");
}

async function applyBoss(m: Mission, ch: BossChallenge[], idxs: number[], reason: string) {
  let hp = m.hp ?? m.hpMax ?? 100;
  for (const i of idxs) {
    ch[i].done = true; hp = Math.max(0, hp - ch[i].damage);
    await award(`boss:${m.id}:${i}`, { xp: Math.round(m.xp * 0.15), coins: 0, label: `${m.title}: ${ch[i].label}` });
  }
  await db.update(geoMissions).set({ req: { ...m.req, challenges: ch }, hp, status: hp > 0 ? "in_progress" : m.status, startedAt: m.startedAt ?? new Date() }).where(eq(geoMissions.id, m.id));
  if (hp <= 0) return { ...(await complete({ ...m, hp }, "boss derrotado")), boss: true, hp };
  return { completed: false, boss: true, hp, damage: idxs.length, reason };
}

/* ───────── Validação a partir de atividade gravada ───────── */
function passes(points: TrackPoint[], target: GeoPoint, radius: number) {
  for (let i = 0; i < points.length; i++) if (haversine(points[i], target) <= radius + Math.min(points[i].acc ?? 0, 20)) return i;
  return -1;
}
function checkpointsInOrder(points: TrackPoint[], cps: GeoPoint[], radius = 35) {
  const visited: number[] = [];
  let from = 0;
  for (let c = 0; c < cps.length; c++) {
    let hit = -1;
    for (let i = from; i < points.length; i++) if (haversine(points[i], cps[c]) <= radius + Math.min(points[i].acc ?? 0, 20)) { hit = i; break; }
    if (hit < 0) break;
    visited.push(c); from = hit + 1;
  }
  return visited;
}

export async function evaluateActivity(activityId: number) {
  const [a] = await db.select().from(activities).where(eq(activities.id, activityId));
  if (!a || a.integrity === "suspect") return []; // atividade suspeita não conta para missões nem bosses
  const active = await db.select().from(geoMissions).where(inArray(geoMissions.status, ["in_progress", "unlocked", "available"]));
  const results: { id: number; title: string; result: unknown }[] = [];
  for (const m of active) {
    if ((m.progress.activityIds ?? []).includes(a.id)) continue;
    if (m.expiresAt && a.startedAt > m.expiresAt) continue; // cada atividade conta uma vez por missão
    // só conta atividades iniciadas depois que a missão foi aceita (evita reaproveitar histórico já contabilizado)
    const accepted = m.startedAt ?? m.createdAt;
    if (a.startedAt < accepted) continue;
    const pts = a.points ?? [];
    const markSeen = (extra: Partial<Mission["progress"]> = {}) => db.update(geoMissions).set({ progress: { ...m.progress, ...extra, activityIds: [...(m.progress.activityIds ?? []), a.id] } }).where(eq(geoMissions.id, m.id));
    let r: unknown = null;
    if ((m.type === "distance" || m.type === "endurance") && m.status === "in_progress") {
      const need = m.req.distanceM ?? 5000;
      await markSeen({ meters: Math.max(m.progress.meters ?? 0, a.distanceM) });
      if (a.distanceM >= need) r = await complete(m, `${(a.distanceM / 1000).toFixed(1)} km em uma atividade`);
    } else if ((m.type === "route" || m.type === "trail") && m.status === "in_progress") {
      const cps = m.req.checkpoints ?? [];
      const visited = checkpointsInOrder(pts, cps);
      const best = visited.length > (m.progress.visited?.length ?? 0) ? visited : m.progress.visited ?? [];
      await markSeen({ visited: best });
      if (cps.length > 0 && visited.length === cps.length) r = await complete(m, "percurso validado pelo GPS");
    } else if (m.type === "boss" && m.status !== "paused") {
      const ch = (m.req.challenges ?? []).map((c) => ({ ...c }));
      const hit: number[] = [];
      ch.forEach((c, i) => {
        if (c.done) return;
        if (c.kind === "distance" && a.distanceM >= c.value) hit.push(i);
        if (c.kind === "climb" && a.elevGainM >= c.value) hit.push(i);
        if (c.kind === "reach" && m.lat != null && m.lng != null && passes(pts, { lat: m.lat, lng: m.lng }, m.radiusM) >= 0) hit.push(i);
        if (c.kind === "route" && (m.req.checkpoints?.length ?? 0) > 0 && checkpointsInOrder(pts, m.req.checkpoints!).length === m.req.checkpoints!.length) hit.push(i);
      });
      await markSeen();
      if (hit.length) r = await applyBoss({ ...m, progress: { ...m.progress, activityIds: [...(m.progress.activityIds ?? []), a.id] } }, ch, hit, "desafio cumprido em atividade");
    } else if (m.type === "climb" && m.lat != null && m.lng != null && m.status !== "paused") {
      // subida: chegar ao cume registrado no trajeto (com altitude coerente quando disponível)
      const i = passes(pts, { lat: m.lat, lng: m.lng }, m.radiusM);
      await markSeen();
      if (i >= 0 && (m.req.targetAltM == null || pts[i].alt == null || pts[i].alt! >= m.req.targetAltM - 40)) r = await complete(m, "cume alcançado no trajeto");
    }
    if (r) results.push({ id: m.id, title: m.title, result: r });
  }
  return results;
}

export async function setState(id: number, action: "start" | "pause" | "resume") {
  const [m] = await db.select().from(geoMissions).where(eq(geoMissions.id, id));
  if (!m || m.status === "completed" || m.status === "expired" || (m.expiresAt && m.expiresAt < new Date())) return { error: "Missão indisponível." };
  const status = action === "pause" ? "paused" : "in_progress";
  await db.update(geoMissions).set({ status, startedAt: m.startedAt ?? new Date() }).where(eq(geoMissions.id, id));
  return { ok: true, status };
}

/* ───────── Geração de missões a partir de dados reais do OpenStreetMap ───────── */
export type OsmEl = { type: "node" | "way"; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; geometry?: { lat: number; lon: number }[]; tags?: Record<string, string> };

function homeGuess(acts: { points: TrackPoint[] }[]) {
  // célula (~220 m) onde mais atividades começam = provável residência → zona de exclusão
  const c = new Map<string, number>();
  for (const a of acts) { const p = a.points?.[0]; if (p) { const k = `${Math.round(p.lat / 0.002)}:${Math.round(p.lng / 0.002)}`; c.set(k, (c.get(k) ?? 0) + 1); } }
  const best = [...c.entries()].sort((a, b) => b[1] - a[1])[0];
  if (!best || best[1] < 2) return null;
  const [y, x] = best[0].split(":").map(Number);
  return { lat: y * 0.002, lng: x * 0.002 };
}

const unsafe = (t: Record<string, string> = {}) =>
  ["private", "no", "military"].includes(t.access ?? "") || ["motorway", "trunk", "motorway_link", "trunk_link", "primary"].includes(t.highway ?? "") || t.landuse === "military" || t.bicycle === "no" && t.foot === "no";

export async function generate(origin: { lat: number; lng: number }, els: OsmEl[], userLevel: number) {
  const existing = await db.select().from(geoMissions).where(ne(geoMissions.status, "completed"));
  const near = existing.filter((m) => m.lat != null && haversine(origin, { lat: m.lat!, lng: m.lng! }) < 4000);
  const refs = new Set(existing.map((m) => m.osmRef).filter(Boolean));
  const acts = await db.select({ points: activities.points }).from(activities);
  const home = homeGuess(acts);
  const ok = (p: { lat: number; lng: number }) => (!home || haversine(home, p) > 250) && haversine(origin, p) > 120;
  const diffOf = (d: number) => Math.min(4, Math.max(1, Math.ceil(d / 1500) + (userLevel >= 6 ? 1 : 0)));
  const nameOf = (t: Record<string, string> = {}, fallback: string) => t.name ?? t["name:pt"] ?? fallback;

  const pts = els.filter((e) => !unsafe(e.tags)).map((e) => {
    const lat = e.lat ?? e.center?.lat ?? (e.geometry ? e.geometry[Math.floor(e.geometry.length / 2)].lat : undefined);
    const lng = e.lon ?? e.center?.lon ?? (e.geometry ? e.geometry[Math.floor(e.geometry.length / 2)].lon : undefined);
    return lat != null && lng != null ? { ...e, plat: lat, plng: lng, dist: haversine(origin, { lat, lng }) } : null;
  }).filter((e): e is NonNullable<typeof e> => !!e && ok({ lat: e.plat, lng: e.plng }) && !refs.has(`${e.type}/${e.id}`));

  const out: (typeof geoMissions.$inferInsert)[] = [];
  const add = (m: typeof geoMissions.$inferInsert) => { if (out.length < 14) out.push(m); };
  const budget = Math.max(0, 10 - near.length);
  const pick = <T,>(arr: T[], n: number) => arr.slice(0, Math.max(0, n));

  const peaks = pts.filter((e) => e.tags?.natural === "peak" || e.tags?.tourism === "viewpoint").sort((a, b) => a.dist - b.dist);
  const parks = pts.filter((e) => e.tags?.leisure === "park").sort((a, b) => a.dist - b.dist);
  const water = pts.filter((e) => e.tags?.amenity === "drinking_water").sort((a, b) => a.dist - b.dist);
  const secrets = pts.filter((e) => e.tags?.historic || e.tags?.tourism === "artwork").sort((a, b) => a.dist - b.dist);
  const trails = pts.filter((e) => e.type === "way" && e.geometry && /^(path|track|cycleway)$/.test(e.tags?.highway ?? "")).map((e) => {
    let len = 0; for (let i = 1; i < e.geometry!.length; i++) len += haversine({ lat: e.geometry![i - 1].lat, lng: e.geometry![i - 1].lon }, { lat: e.geometry![i].lat, lng: e.geometry![i].lon });
    return { ...e, len };
  }).filter((e) => e.len >= 400 && e.len <= 8000).sort((a, b) => a.dist - b.dist);

  if (budget > 0) {
    for (const e of pick(peaks, 2)) {
      const ele = Number(e.tags?.ele); const d = diffOf(e.dist);
      add({ type: "climb", title: `Subida: ${nameOf(e.tags, e.tags?.natural === "peak" ? "Cume sem nome" : "Mirante")}`, description: `Alcance ${e.tags?.natural === "peak" ? "o cume" : "o mirante"}${isFinite(ele) ? ` a ${Math.round(ele)} m de altitude` : ""}. Conclui ao chegar no local ou quando o trajeto gravado passar por ele.`, emblem: TYPE_EMBLEM.climb, lat: e.plat, lng: e.plng, radiusM: 40, difficulty: d, xp: 120 * d, coins: 15 * d, item: d >= 3 ? "helmet-cycling-blue" : null, req: { targetAltM: isFinite(ele) ? ele : undefined }, osmRef: `${e.type}/${e.id}`, verified: true });
    }
    for (const e of pick(parks, 3)) { const d = diffOf(e.dist); add({ type: "exploration", title: `Explorar ${nameOf(e.tags, "parque")}`, description: "Chegue ao ponto marcado e capture a bandeira de exploração.", emblem: TYPE_EMBLEM.exploration, lat: e.plat, lng: e.plng, radiusM: 40, difficulty: d, xp: 80 * d, coins: 10 * d, osmRef: `${e.type}/${e.id}`, verified: true }); }
    for (const e of pick(water, 2)) { const d = diffOf(e.dist); add({ type: "chest", title: "Baú de recompensa", description: "Um baú escondido junto a um ponto de água. Pare, hidrate-se e capture.", emblem: TYPE_EMBLEM.chest, lat: e.plat, lng: e.plng, radiusM: 30, difficulty: d, xp: 60 * d, coins: 40 * d, item: "potion-lightning", osmRef: `${e.type}/${e.id}`, verified: true }); }
    for (const e of pick(secrets, 2)) { const d = diffOf(e.dist) + 1; add({ type: "secret", title: "Local secreto", description: `Algo especial está escondido aqui${e.tags?.name ? ` (${e.tags.name})` : ""}. Revelado apenas quando você estiver a menos de 300 m.`, emblem: TYPE_EMBLEM.secret, lat: e.plat, lng: e.plng, radiusM: 30, difficulty: Math.min(4, d), xp: 150 * d, coins: 25 * d, item: "crystal-purple", osmRef: `${e.type}/${e.id}`, verified: true }); }
    for (const e of pick(trails, 1)) {
      const g = e.geometry!; const cps: GeoPoint[] = [g[0], g[Math.floor(g.length / 2)], g[g.length - 1]].map((p, i) => ({ lat: p.lat, lng: p.lon, name: ["Início", "Meio", "Fim"][i] }));
      const d = Math.min(4, Math.ceil(e.len / 2000) + 1);
      add({ type: "trail", title: `Trilha: ${nameOf(e.tags, "trecho sem nome")}`, description: `Complete o trecho de ${(e.len / 1000).toFixed(1)} km passando pelos 3 checkpoints, na ordem, com a atividade gravando. Geometria do OpenStreetMap — confira sinalização e condições no local.`, emblem: TYPE_EMBLEM.trail, lat: cps[0].lat, lng: cps[0].lng, radiusM: 35, difficulty: d, xp: 200 * d, coins: 30 * d, item: "badge-mtb-trail", req: { checkpoints: cps, path: g.map((p) => [p.lat, p.lon]), distanceM: e.len }, osmRef: `${e.type}/${e.id}`, verified: true });
    }
    // Percurso de aventura: ponto de exploração → intermediário → cume/mirante (linha reta entre checkpoints)
    const summit = peaks[0] ?? parks[parks.length - 1];
    const startP = parks[0] ?? water[0];
    const midP = [...parks, ...water, ...secrets].find((e) => e !== startP && e !== summit);
    if (summit && startP && midP && startP !== summit) {
      const cps: GeoPoint[] = [startP, midP, summit].map((e, i) => ({ lat: e.plat, lng: e.plng, name: [nameOf(e.tags, "Partida"), nameOf(e.tags, "Ponto intermediário"), nameOf(e.tags, "Destino")][i] }));
      const dist = haversine(cps[0], cps[1]) + haversine(cps[1], cps[2]);
      const d = Math.min(4, Math.ceil(dist / 3000) + 1);
      add({ type: "route", title: summit.tags?.natural === "peak" ? "Conquista da Montanha" : "Rota de Aventura", description: "Passe pelos pontos de controle na ordem durante uma atividade gravada. A linha entre os pontos é uma referência em linha reta: o caminho real precisa ser verificado.", emblem: TYPE_EMBLEM.route, lat: cps[0].lat, lng: cps[0].lng, radiusM: 40, difficulty: d, xp: 300 * d, coins: 50 * d, item: "trophy-gold", req: { checkpoints: cps, distanceM: dist }, osmRef: `route/${startP.id}-${summit.id}`, verified: false });
    }
  }

  // Boss geográfico (um por região)
  if (!near.some((m) => m.type === "boss")) {
    const spot = peaks[peaks.length - 1] ?? trails[0] ?? parks[parks.length - 1];
    if (spot) {
      const cat = userLevel >= 8 ? "legendary" : spot.tags?.natural === "peak" || spot.tags?.tourism === "viewpoint" ? "climb" : spot.type === "way" ? "endurance" : "exploration";
      const k = Math.min(3, 1 + Math.floor(userLevel / 4));
      const challenges: BossChallenge[] = [
        { kind: "reach", label: "Alcançar o covil do boss", value: 0, damage: 35, done: false },
        { kind: "distance", label: `Completar ${5 * k} km em uma atividade`, value: 5000 * k, damage: 35, done: false },
        { kind: "climb", label: `Acumular ${100 * k} m de subida em uma atividade`, value: 100 * k, damage: 30, done: false },
      ];
      if (cat === "legendary") challenges.push({ kind: "distance", label: `Resistir ${20 * k} km em uma atividade`, value: 20000 * k, damage: 40, done: false });
      const hpMax = challenges.reduce((s, c) => s + c.damage, 0);
      add({ type: "boss", category: cat, title: BOSS_STYLE[cat].name, description: "Um boss guarda esta área. Cada desafio real cumprido tira HP. Presença no local exige estar lá; distância e subida contam em atividades gravadas após aceitar o confronto.", emblem: "boss-golem", lat: spot.plat, lng: spot.plng, radiusM: 50, difficulty: cat === "legendary" ? 4 : 3, xp: cat === "legendary" ? 2000 : 800, coins: cat === "legendary" ? 500 : 200, item: "shield-star-laurel", hp: hpMax, hpMax, req: { challenges }, osmRef: `boss/${spot.type}/${spot.id}`, verified: spot.type === "node" });
    }
  }

  // Objetivos sem localização fixa (distância / resistência), escalados pelo nível
  if (!existing.some((m) => m.type === "distance")) add({ type: "distance", title: `Distância: ${5 + userLevel} km`, description: `Percorra ${5 + userLevel} km em uma única atividade gravada.`, emblem: TYPE_EMBLEM.distance, difficulty: 1 + Math.floor(userLevel / 4), xp: 150 + userLevel * 15, coins: 20, req: { distanceM: (5 + userLevel) * 1000 } });
  if (!existing.some((m) => m.type === "endurance")) add({ type: "endurance", title: `Resistência: ${10 + userLevel * 2} km`, description: `Complete um percurso de ${10 + userLevel * 2} km sem descartar a atividade.`, emblem: TYPE_EMBLEM.endurance, difficulty: 2 + Math.floor(userLevel / 5), xp: 300 + userLevel * 25, coins: 40, item: "medal-bike", req: { distanceM: (10 + userLevel * 2) * 1000 } });

  if (out.length) await db.insert(geoMissions).values(out.map((m) => ({ ...m, difficulty: Math.min(4, Math.max(1, m.difficulty ?? 1)) })));
  return { created: out.length, homeExcluded: !!home, sourceCount: els.length };
}

export async function listMissions() {
  return db.select().from(geoMissions).where(ne(geoMissions.status, "expired")).orderBy(desc(geoMissions.createdAt));
}
export { GEO_TYPES };

/* ───────── Check-in fotográfico: presença real (GPS) + foto tirada pelo app ───────── */
export async function photoCheckin(id: number, p: { lat: number; lng: number; acc: number; speed: number | null; data: unknown }) {
  const [m] = await db.select().from(geoMissions).where(eq(geoMissions.id, id));
  if (!m || m.type !== "photo" || m.lat == null || m.lng == null) return { error: "Desafio não encontrado." };
  if (m.status === "completed") return { error: "Desafio já concluído." };
  if (m.status === "expired" || (m.expiresAt && m.expiresAt < new Date())) return { error: "O tempo deste desafio acabou." };
  if (typeof p.data !== "string" || !/^data:image\/(webp|jpeg);base64,/.test(p.data) || p.data.length > 900_000 || p.data.length < 3000) return { error: "Foto inválida." };
  if (!isFinite(p.lat) || !isFinite(p.lng) || !isFinite(p.acc)) return { error: "Coordenadas inválidas." };
  if (p.acc > 50) return { error: `Precisão do GPS insuficiente (±${Math.round(p.acc)} m).` };
  if (p.speed != null && p.speed > 2.5) return { error: "Pare em local seguro para fotografar." };
  const limit = Math.max(m.radiusM, 80) + Math.min(p.acc, 25);
  const d = haversine({ lat: m.lat, lng: m.lng }, p);
  if (d > limit) return { error: `Você está a ${Math.round(d)} m. Aproxime-se até ${Math.round(limit)} m para o check-in.` };
  await db.update(geoMissions).set({ photo: p.data }).where(eq(geoMissions.id, id));
  return complete(m, "check-in fotográfico");
}
