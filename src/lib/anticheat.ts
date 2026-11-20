// Validação anti-trapaça — roda no servidor (decisão final) e no cliente (aviso ao vivo). Sem dependências de servidor.
import { haversine } from "./format";

export type Pt = { lat: number; lng: number; alt: number | null; t: number; acc: number; spd?: number | null };
export type Group = "corrida" | "caminhada" | "ciclismo" | "outros";
export type Integrity = { status: "valid" | "suspect"; reasons: string[]; maxSustainedKmh: number; teleports: number; trackDistanceM: number };

// km/h sustentados acima disso = incompatível com a modalidade
export const SPEED_LIMIT_KMH: Record<Group, number> = { caminhada: 12, corrida: 26, ciclismo: 60, outros: 60 };
const MAX_ACC_M = 35; // leituras piores que isso não entram na análise (evita falso positivo com sinal oscilando)
const SUSTAIN_S = 45; // janela mínima para considerar velocidade "sustentada"
const TELEPORT_MS = 85; // ~300 km/h entre dois pontos = salto impossível
const GROUP_LABEL: Record<Group, string> = { caminhada: "caminhada", corrida: "corrida", ciclismo: "ciclismo", outros: "esta modalidade" };

/** Remove leituras imprecisas e saltos impossíveis (teleporte). Retorna também a contagem de saltos. */
export function cleanTrack(points: Pt[]) {
  const good = points.filter((p) => isFinite(p.lat) && isFinite(p.lng) && isFinite(p.t) && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180 && (p.acc ?? 0) <= MAX_ACC_M).sort((a, b) => a.t - b.t);
  const out: Pt[] = [];
  let teleports = 0;
  for (const p of good) {
    const last = out[out.length - 1];
    if (last) {
      const dt = (p.t - last.t) / 1000;
      if (dt <= 0) continue;
      const v = haversine(last, p) / dt;
      if (v > TELEPORT_MS || (haversine(last, p) > 1000 && dt < 10)) { teleports++; continue; }
    }
    out.push(p);
  }
  return { points: out, teleports, dropped: points.length - out.length };
}

/** Maior velocidade média em qualquer janela ≥ SUSTAIN_S (ignora pausas longas). Em ciclismo, descidas fortes são toleradas. */
function maxSustained(points: Pt[], group: Group) {
  let best = 0, j = 0, dist = 0;
  const seg: number[] = [0];
  for (let i = 1; i < points.length; i++) seg.push(points[i].t - points[i - 1].t > 60000 ? 0 : haversine(points[i - 1], points[i]));
  for (let i = 1; i < points.length; i++) {
    dist += seg[i];
    while (j < i && (points[i].t - points[j + 1].t) / 1000 >= SUSTAIN_S) { dist -= seg[j + 1]; j++; }
    const dt = (points[i].t - points[j].t) / 1000;
    if (dt < SUSTAIN_S || dist < 150) continue;
    const kmh = (dist / dt) * 3.6;
    if (group === "ciclismo" && points[i].alt != null && points[j].alt != null && (points[j].alt! - points[i].alt!) / dist >= 0.04) continue; // descida ≥4%: pico real permitido
    if (kmh > best) best = kmh;
  }
  return best;
}

/** Aceleração típica de veículo: de <8 km/h para >40 km/h em ≤10 s (corrida/caminhada). */
function vehicleAcceleration(points: Pt[]) {
  const sp: { t: number; v: number }[] = [];
  for (let i = 1; i < points.length; i++) { const dt = (points[i].t - points[i - 1].t) / 1000; if (dt >= 2 && dt <= 15) sp.push({ t: points[i].t, v: (haversine(points[i - 1], points[i]) / dt) * 3.6 }); }
  let hits = 0;
  for (let i = 0; i < sp.length; i++) if (sp[i].v < 8) for (let k = i + 1; k < sp.length && sp[k].t - sp[i].t <= 10000; k++) if (sp[k].v > 40) { hits++; break; }
  return hits;
}

export function analyzeActivity(input: { points: Pt[]; group: Group; gps: boolean; distanceM: number; movingSec: number }): Integrity {
  const limit = SPEED_LIMIT_KMH[input.group];
  const reasons: string[] = [];
  const { points, teleports } = cleanTrack(input.points ?? []);
  let trackDistanceM = 0;
  for (let i = 1; i < points.length; i++) if (points[i].t - points[i - 1].t <= 60000) trackDistanceM += haversine(points[i - 1], points[i]);
  const sustained = points.length > 3 ? maxSustained(points, input.group) : 0;

  if (sustained > limit) reasons.push(`Velocidade sustentada de ${Math.round(sustained)} km/h, acima do limite de ${limit} km/h para ${GROUP_LABEL[input.group]}.`);
  if (input.group !== "ciclismo" && vehicleAcceleration(points) >= 2) reasons.push("Acelerações típicas de veículo motorizado detectadas.");
  if (teleports >= 3) reasons.push("Saltos de localização impossíveis detectados (possível GPS falso).");
  // média geral declarada (impede inflar distância/tempo manualmente, inclusive em indoor)
  const avgKmh = input.movingSec > 0 ? (input.distanceM / input.movingSec) * 3.6 : 0;
  const netDescent = points.length > 1 && points[0].alt != null && points[points.length - 1].alt != null && trackDistanceM > 0 ? (points[0].alt! - points[points.length - 1].alt!) / trackDistanceM : 0;
  const descentOk = input.group === "ciclismo" && netDescent >= 0.04; // descida longa real em bike
  if (avgKmh > limit && !descentOk) reasons.push(`Ritmo médio de ${avgKmh.toFixed(1)} km/h incompatível com ${GROUP_LABEL[input.group]}.`);
  if (input.gps && points.length >= 2 && input.distanceM > trackDistanceM * 1.25 + 200) reasons.push("Distância declarada maior que a do trajeto GPS registrado.");
  if (input.gps && input.distanceM > 500 && points.length < 3) reasons.push("Distância sem trajeto GPS correspondente.");

  return { status: reasons.length ? "suspect" : "valid", reasons, maxSustainedKmh: Math.round(sustained), teleports, trackDistanceM: Math.round(trackDistanceM) };
}

/** Versão incremental para o aviso ao vivo durante a gravação. */
export function liveCheck(points: Pt[], group: Group) {
  const recent = cleanTrack(points.slice(-120)).points;
  const s = recent.length > 3 ? maxSustained(recent, group) : 0;
  return { over: s > SPEED_LIMIT_KMH[group], kmh: Math.round(s), limit: SPEED_LIMIT_KMH[group] };
}
