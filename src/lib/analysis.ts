import type { TrackPoint } from "@/db/schema";
import { haversine } from "./format";

export function splits(points: TrackPoint[]) {
  const out: { km: number; sec: number; elev: number; partial?: number }[] = [];
  let dist = 0, startT = points[0]?.t ?? 0, startAlt = points[0]?.alt ?? 0, next = 1000;
  for (let i = 1; i < points.length; i++) {
    const d = haversine(points[i - 1], points[i]);
    // ignora pausas longas entre pontos (>60s)
    if (points[i].t - points[i - 1].t > 60000) startT += points[i].t - points[i - 1].t;
    dist += d;
    if (dist >= next) {
      out.push({ km: next / 1000, sec: (points[i].t - startT) / 1000, elev: (points[i].alt ?? 0) - (startAlt ?? 0) });
      startT = points[i].t; startAlt = points[i].alt ?? 0; next += 1000;
    }
  }
  const last = points[points.length - 1];
  const rem = dist - (next - 1000);
  if (last && rem > 100) out.push({ km: next / 1000, sec: (last.t - startT) / 1000, elev: (last.alt ?? 0) - (startAlt ?? 0), partial: rem });
  return out;
}

export function elevationProfile(points: TrackPoint[], n = 120) {
  const withAlt: { d: number; alt: number }[] = [];
  let d = 0;
  for (let i = 0; i < points.length; i++) {
    if (i > 0) d += haversine(points[i - 1], points[i]);
    if (points[i].alt != null) withAlt.push({ d, alt: points[i].alt! });
  }
  if (withAlt.length < 2) return [];
  const step = Math.max(1, Math.floor(withAlt.length / n));
  return withAlt.filter((_, i) => i % step === 0);
}
