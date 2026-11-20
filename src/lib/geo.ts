import type { TrackPoint } from "@/db/schema";

const EARTH_R = 6371000;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Distância real entre duas coordenadas (Haversine). */
export function haversine(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export type LiveStats = {
  distanceM: number;
  movingSec: number;
  elapsedSec: number;
  elevGainM: number;
  elevLossM: number;
  maxSpeedKmh: number;
  currentSpeedKmh: number;
  avgSpeedKmh: number;
  paceSecPerKm: number;
  calories: number;
  points: number;
  accuracyM: number;
  maxElevM: number;
};

/** Estatísticas completas calculadas a partir dos pontos reais gravados. */
export function computeTrackStats(
  track: TrackPoint[],
  opts: { elapsedSec: number; movingSec: number; weightKg?: number; sport?: string; calories?: number },
): LiveStats {
  const distanceM = totalDistance(track);
  const { gain, loss, maxAlt } = elevationStats(track);
  const maxSpeedKmh = track.reduce((max, p) => Math.max(max, p.spd ?? 0), 0);
  const avgSpeedKmh = opts.movingSec > 0 ? (distanceM / 1000 / (opts.movingSec / 3600)) : 0;
  const paceSecPerKm = distanceM > 20 ? opts.movingSec / (distanceM / 1000) : 0;
  const accuracy =
    track.length > 0 ? track.reduce((sum, p) => sum + (p.acc ?? 0), 0) / track.length : 0;
  return {
    distanceM,
    movingSec: opts.movingSec,
    elapsedSec: opts.elapsedSec,
    elevGainM: gain,
    elevLossM: loss,
    maxSpeedKmh,
    currentSpeedKmh: lastSpeed(track),
    avgSpeedKmh,
    paceSecPerKm,
    calories:
      opts.calories ??
      estimateCalories(opts.sport ?? "run", distanceM, opts.movingSec, opts.weightKg ?? 72),
    points: track.length,
    accuracyM: accuracy,
    maxElevM: maxAlt,
  };
}

/** Importação dinâmica evitada: fórmula de MET local para não depender do server bundle no cliente. */
export function estimateCalories(sport: string, distanceM: number, movingSec: number, weightKg = 72): number {
  if (movingSec <= 0) return 0;
  const hours = movingSec / 3600;
  const kmh = distanceM / 1000 / hours;
  let met: number;
  if (sport.startsWith("ride") || sport === "mtb" || sport === "gravel") {
    met = sport === "ebike" ? 3.5 + kmh * 0.16 : 3.5 + kmh * 0.42;
    met = Math.min(met, 18);
  } else if (sport.startsWith("walk") || sport === "hike") {
    met = Math.min(Math.max(1.35 * kmh + 0.6, 2.5), 12);
  } else {
    met = Math.min(1.05 * kmh + 1.2, 26);
  }
  return Math.round(met * weightKg * hours);
}

export function totalDistance(track: TrackPoint[]): number {
  let total = 0;
  for (let i = 1; i < track.length; i += 1) {
    total += haversine(track[i - 1].lat, track[i - 1].lng, track[i].lat, track[i].lng);
  }
  return total;
}

export function elevationStats(track: TrackPoint[]): { gain: number; loss: number; maxAlt: number } {
  let gain = 0;
  let loss = 0;
  let maxAlt = -Infinity;
  let baseline: number | null = null;
  for (const p of track) {
    if (typeof p.alt !== "number" || Number.isNaN(p.alt)) continue;
    maxAlt = Math.max(maxAlt, p.alt);
    if (baseline === null) baseline = p.alt;
    const delta = p.alt - baseline;
    if (delta > 1.5) {
      gain += delta;
      baseline = p.alt;
    } else if (delta < -1.5) {
      loss += -delta;
      baseline = p.alt;
    }
  }
  return { gain, loss, maxAlt: Number.isFinite(maxAlt) ? maxAlt : 0 };
}

export function lastSpeed(track: TrackPoint[]): number {
  for (let i = track.length - 1; i >= 0 && i >= track.length - 6; i -= 1) {
    const s = track[i].spd;
    if (typeof s === "number" && s > 0) return s;
  }
  return 0;
}

export type Split = {
  km: number;
  seconds: number;
  paceSecPerKm: number;
  elevGainM: number;
  distanceM: number;
};

/** Splits reais por quilômetro a partir da trilha gravada. */
export function computeSplits(track: TrackPoint[]): Split[] {
  if (track.length < 2) return [];
  const splits: Split[] = [];
  let acc = 0;
  let gain = 0;
  let lastAlt: number | null = null;
  let splitStart = track[0].t;
  for (let i = 1; i < track.length; i += 1) {
    const a = track[i - 1];
    const b = track[i];
    const seg = haversine(a.lat, a.lng, b.lat, b.lng);
    const dt = Math.max(0, (b.t - a.t) / 1000);
    acc += seg;
    if (typeof b.alt === "number") {
      if (lastAlt !== null) {
        const d = b.alt - lastAlt;
        if (d > 1.5) gain += d;
      }
      lastAlt = b.alt;
    }
    if (acc >= 1000) {
      const elapsed = (b.t - splitStart) / 1000;
      const km = splits.length + 1;
      splits.push({
        km,
        seconds: Math.round(elapsed),
        paceSecPerKm: elapsed,
        elevGainM: gain,
        distanceM: acc,
      });
      acc = 0;
      gain = 0;
      splitStart = b.t;
    }
    void dt;
  }
  if (acc > 60 && splits.length > 0) {
    const elapsed = (track[track.length - 1].t - splitStart) / 1000;
    splits.push({
      km: splits.length + 1,
      seconds: Math.round(elapsed),
      paceSecPerKm: elapsed / (acc / 1000),
      elevGainM: gain,
      distanceM: acc,
    });
  }
  return splits;
}

export type Bounds = { minLat: number; maxLat: number; minLng: number; maxLng: number };

export function trackBounds(track: { lat: number; lng: number }[]): Bounds | null {
  if (track.length === 0) return null;
  let minLat = track[0].lat;
  let maxLat = track[0].lat;
  let minLng = track[0].lng;
  let maxLng = track[0].lng;
  for (const p of track) {
    minLat = Math.min(minLat, p.lat);
    maxLat = Math.max(maxLat, p.lat);
    minLng = Math.min(minLng, p.lng);
    maxLng = Math.max(maxLng, p.lng);
  }
  return { minLat, maxLat, minLng, maxLng };
}

/**
 * Projeta a trilha em um sistema local (metros) para desenhar o mini-mapa SVG
 * sem depender de tiles externos.
 */
export function projectTrack(track: { lat: number; lng: number }[]): { x: number; y: number }[] {
  if (track.length === 0) return [];
  const b = trackBounds(track)!;
  const midLat = (b.minLat + b.maxLat) / 2;
  const kx = Math.cos(toRad(midLat)) * 111320;
  const ky = 110540;
  return track.map((p) => ({ x: (p.lng - b.minLng) * kx, y: (b.maxLat - p.lat) * ky }));
}

export function svgPath(track: { lat: number; lng: number }[], width: number, height: number, pad = 8): string {
  const pts = projectTrack(track);
  if (pts.length === 0) return "";
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of pts) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  const spanX = Math.max(1, maxX - minX);
  const spanY = Math.max(1, maxY - minY);
  const scale = Math.min((width - pad * 2) / spanX, (height - pad * 2) / spanY);
  const offX = (width - spanX * scale) / 2;
  const offY = (height - spanY * scale) / 2;
  return pts
    .map((p, i) => {
      const x = (p.x - minX) * scale + offX;
      const y = (p.y - minY) * scale + offY;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
}

export function startEnd(track: { lat: number; lng: number }[]): { start: { lat: number; lng: number } | null; end: { lat: number; lng: number } | null } {
  if (track.length === 0) return { start: null, end: null };
  return { start: track[0], end: track[track.length - 1] };
}

/** Distância total do trajeto dentro de um círculo (território). */
export function distanceInsideCircle(track: { lat: number; lng: number }[], lat: number, lng: number, radiusM: number): number {
  let inside = 0;
  for (let i = 1; i < track.length; i += 1) {
    const a = track[i - 1];
    const b = track[i];
    const midLat = (a.lat + b.lat) / 2;
    const midLng = (a.lng + b.lng) / 2;
    if (haversine(midLat, midLng, lat, lng) <= radiusM) {
      inside += haversine(a.lat, a.lng, b.lat, b.lng);
    }
  }
  return inside;
}

/** Velocidade instantânea entre dois pontos (km/h). */
export function speedBetween(a: TrackPoint, b: TrackPoint): number {
  const dt = (b.t - a.t) / 1000;
  if (dt <= 0.3) return 0;
  const d = haversine(a.lat, a.lng, b.lat, b.lng);
  return (d / dt) * 3.6;
}

/** Compatibilidade com um segmento: proximidade de largada/chegada. */
export function matchSegment(
  track: TrackPoint[],
  seg: { startLat: number; startLng: number; endLat: number; endLng: number; distanceM: number },
  maxStartM = 150,
  maxEndM = 200,
): number | null {
  if (track.length < 4) return null;
  const start = track[0];
  const end = track[track.length - 1];
  const dStart = haversine(start.lat, start.lng, seg.startLat, seg.startLng);
  const dEnd = haversine(end.lat, end.lng, seg.endLat, seg.endLng);
  if (dStart > maxStartM || dEnd > maxEndM) return null;
  const total = totalDistance(track);
  if (seg.distanceM > 0 && Math.abs(total - seg.distanceM) / seg.distanceM > 0.35) return null;
  const elapsedSec = Math.max(1, Math.round((end.t - start.t) / 1000));
  return elapsedSec;
}

export function weekStart(date = new Date()): Date {
  const d = new Date(date);
  const day = (d.getDay() + 6) % 7; // segunda-feira
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - day);
  return d;
}
