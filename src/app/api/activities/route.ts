import { db } from "@/db";
import { activities, type TrackPoint } from "@/db/schema";
import { requireApiUser } from "@/lib/auth";
import { haversine } from "@/lib/geo";
import { defaultActivityName, getSport } from "@/lib/sports";
import { evaluateIntegrity, sanitizeTrack } from "@/lib/anticheat";

export const dynamic = "force-dynamic";

type Payload = {
  sport?: string;
  name?: string | null;
  startedAt?: string;
  elapsedSec?: number;
  movingSec?: number;
  distanceM?: number;
  maxSpeedKmh?: number;
  elevGainM?: number;
  elevLossM?: number;
  calories?: number;
  pauses?: number;
  autoPauses?: number;
  gpsPoints?: number;
  avgAccuracyM?: number;
  device?: string;
  track?: TrackPoint[];
};

export async function POST(request: Request) {
  const user = await requireApiUser();
  if (!user) return Response.json({ ok: false, error: "Não autenticado" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as Payload | null;
  if (!body?.sport || !getSport(body.sport)) {
    return Response.json({ ok: false, error: "Modalidade inválida" }, { status: 400 });
  }
  const sport = getSport(body.sport);
  const rawTrack = Array.isArray(body.track) ? body.track.slice(0, 30000) : [];
  // Normaliza as amostras enviadas: coordenação válida e timestamps numéricos.
  const normalized: TrackPoint[] = rawTrack
    .filter((p) => Number.isFinite(p?.lat) && Number.isFinite(p?.lng) && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180)
    .map((p) => ({ t: p.t, lat: p.lat, lng: p.lng, acc: p.acc, alt: p.alt, spd: p.spd }));

  // 1) Limpeza: descarta precisão ruim e saltos impossíveis antes de calcular.
  const { points: cleanTrack, discarded } = sanitizeTrack(normalized, body.sport);

  // 2) Veredito de integridade — calculado NO SERVIDOR sobre o que foi enviado.
  //    O cliente não pode marcar a atividade como válida.
  const integrity = evaluateIntegrity(body.sport, normalized, { isIndoor: !sport.outdoor });

  const elapsedSec = Math.max(0, Math.round(body.elapsedSec ?? 0));
  const movingSec = Math.max(0, Math.round(body.movingSec ?? elapsedSec));
  // Distância confiável: em percurso suspeito/inválido prevalece a distância
  // recalculada a partir das amostras aceitas, não a informada pelo cliente.
  const reportedDistance = Math.max(0, Math.round(body.distanceM ?? 0));
  const trustedDistance = Math.round(
    cleanTrack.length > 2
      ? cleanTrack.reduce((sum, p, i) => {
          if (i === 0) return 0;
          return sum + haversine(cleanTrack[i - 1].lat, cleanTrack[i - 1].lng, p.lat, p.lng);
        }, 0)
      : reportedDistance,
  );
  const distanceM = integrity.status === "valid" ? reportedDistance : trustedDistance;
  const avgSpeedKmh = movingSec > 0 ? Number(((distanceM / 1000) / (movingSec / 3600)).toFixed(2)) : 0;
  const paceSecPerKm = distanceM > 30 ? Number((movingSec / (distanceM / 1000)).toFixed(2)) : 0;
  const maxSpeedKmh = Math.max(0, Math.min(body.maxSpeedKmh ?? 0, sport.plausibleMaxKmh));

  const [created] = await db
    .insert(activities)
    .values({
      userId: user.id,
      sport: body.sport,
      subtype: null,
      name: (body.name ?? "").trim() || defaultActivityName(body.sport),
      startedAt: body.startedAt ? new Date(body.startedAt) : new Date(),
      endedAt: new Date(),
      elapsedSec,
      movingSec,
      distanceM,
      avgSpeedKmh,
      maxSpeedKmh,
      paceSecPerKm,
      elevGainM: Math.max(0, Math.round(body.elevGainM ?? 0)),
      elevLossM: Math.max(0, Math.round(body.elevLossM ?? 0)),
      calories: Math.max(0, Math.round(body.calories ?? 0)),
      pauses: Math.max(0, Math.round(body.pauses ?? 0)),
      autoPauses: Math.max(0, Math.round(body.autoPauses ?? 0)),
      gpsPoints: cleanTrack.length,
      avgAccuracyM: Number((body.avgAccuracyM ?? 0).toFixed(1)),
      integrityStatus: integrity.status,
      integrityReason: integrity.reason,
      integrityMetrics: {
        maxSustainedKmh: Number(integrity.metrics.maxSustainedKmh.toFixed(2)),
        limitKmh: integrity.metrics.limitKmh,
        teleports: integrity.metrics.teleports,
        lowAccuracyPoints: integrity.metrics.lowAccuracyPoints,
        analyzedPoints: integrity.metrics.analyzedPoints,
      },
      maxSustainedKmh: Number(integrity.metrics.maxSustainedKmh.toFixed(2)),
      discardedPoints: discarded,
      device: (body.device ?? "").slice(0, 110) || "GPS do dispositivo",
      isIndoor: !sport.outdoor,
      status: "draft",
      visibility: "public",
      track: cleanTrack,
    })
    .returning({ id: activities.id });

  return Response.json({
    ok: true,
    id: created.id,
    trackPoints: cleanTrack.length,
    integrity: {
      status: integrity.status,
      reason: integrity.reason,
      maxSustainedKmh: Number(integrity.metrics.maxSustainedKmh.toFixed(2)),
      limitKmh: integrity.metrics.limitKmh,
      discarded,
    },
  });
}
