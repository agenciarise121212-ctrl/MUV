import { haversine } from "@/lib/geo";
import { getSport } from "@/lib/sports";
import type { TrackPoint } from "@/db/schema";

/**
 * Motor de validação de integridade das atividades (anti-trapaça).
 *
 * Módulo puro e seguro para o bundle do cliente: usado no dispositivo para dar
 * feedback imediato e no servidor como veredito final, comparando coordenadas
 * e timestamps realmente enviados. Nada é confiado por chave — o cliente não
 * pode marcar a atividade como válida.
 *
 * Detecta três classes de trapaça:
 *  1. Veículo motorizado: velocidade sustentada acima do teto da modalidade.
 *  2. Teleporte / GPS falso: salto de distância fisicamente impossível entre
 *     duas amostras, ou aceleração típica de veículo em modalidade a pé.
 *  3. Sinal degradado: precisão tão ruim que a distância deixa de ser confiável.
 */

export type IntegrityStatus = "valid" | "suspicious" | "invalid";

/** Limite de velocidade SUSTENTADA por família de modalidade (km/h). */
export const SUSTAINED_LIMIT: Record<string, number> = {
  walk: 12,
  run: 26,
  ride: 60,
};

export const FAMILY_LABEL: Record<string, string> = {
  walk: "caminhada",
  run: "corrida",
  ride: "ciclismo",
};

/**
 * Velocidade física absoluta entre duas amostras (km/h) acima da qual o salto
 * é considerado teleporte, independente da modalidade. 90 km/h em trecho plano
 * já é ritmo de automóvel em via urbana; acima disso é impossível a pedal.
 */
const TELEPORT_KMH = 90;
/** Distância mínima para o salto ser tratado como teleporte (m). */
const TELEPORT_MIN_METERS = 250;
/** Precisão máxima (m) de uma amostra para entrar no cálculo de velocidade. */
export const MAX_USABLE_ACCURACY = 60;

/**
 * Janela de sustentação: velocidade média contínua acima do limite por este
 * número de segundos caracteriza veículo, não pico momentâneo de descida.
 */
const SUSTAIN_WINDOW_SEC = 45;
/** Aceleração (km/h em 5 s) que caracteriza partida de veículo motorizado. */
const VEHICLE_ACCEL_KMH_PER_5S = 40;

export type IntegrityFinding = {
  code: "vehicle_speed" | "teleport" | "vehicle_acceleration" | "degraded_signal";
  message: string;
  /** Velocidade observada, quando aplicável. */
  observedKmh?: number;
  /** Quantidade de ocorrências. */
  hits: number;
};

export type IntegrityReport = {
  status: IntegrityStatus;
  /** Motivo principal, em português, pronto para exibição. */
  reason: string | null;
  findings: IntegrityFinding[];
  metrics: {
    /** Maior velocidade média sustentada dentro da janela (km/h). */
    maxSustainedKmh: number;
    /** Limite aplicado à modalidade (km/h). */
    limitKmh: number;
    /** Saltos impossíveis descartados. */
    teleports: number;
    /** Amostras descartadas por precisão ruim. */
    lowAccuracyPoints: number;
    /** Total de amostras analisadas. */
    analyzedPoints: number;
    /** Distância confiável recalculada (m). */
    trustedDistanceM: number;
  };
};

type FamilyKey = "walk" | "run" | "ride";

export function familyOf(sportKey: string): FamilyKey {
  const sport = getSport(sportKey);
  if (sport.category === "ride") return "ride";
  if (sport.category === "walk") return "walk";
  return "run";
}

export function limitFor(sportKey: string): number {
  return SUSTAINED_LIMIT[familyOf(sportKey)];
}

/** Teto absoluto da modalidade: acima disso a amostra é ruído, não movimento. */
function absoluteCeiling(sportKey: string): number {
  return getSport(sportKey).plausibleMaxKmh;
}

type Sample = { t: number; lat: number; lng: number; acc: number; dist: number; kmh: number };

/** Constrói amostras confiáveis: descarta precisão ruim e gaps temporais longos. */
function buildSamples(track: TrackPoint[]): { samples: Sample[]; lowAccuracy: number } {
  const usable = track
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))
    .filter((p) => typeof p.acc !== "number" || p.acc <= MAX_USABLE_ACCURACY);
  const lowAccuracy = track.length - usable.length;

  const samples: Sample[] = [];
  for (let i = 1; i < usable.length; i += 1) {
    const a = usable[i - 1];
    const b = usable[i];
    const dt = (b.t - a.t) / 1000;
    if (dt <= 0.4) continue; // amostras demais no mesmo instante
    const dist = haversine(a.lat, a.lng, b.lat, b.lng);
    samples.push({ t: b.t, lat: b.lat, lng: b.lng, acc: b.acc ?? 0, dist, kmh: (dist / dt) * 3.6 });
  }
  return { samples, lowAccuracy };
}

/** Maior velocidade média contínua dentro da janela de sustentação. */
function maxSustainedKmh(samples: Sample[], windowSec: number): number {
  if (samples.length === 0) return 0;
  let best = 0;
  let start = 0;
  let distance = 0;
  let elapsed = 0;
  for (let end = 0; end < samples.length; end += 1) {
    distance += samples[end].dist;
    elapsed += (end === 0 ? 0 : (samples[end].t - samples[end - 1].t) / 1000) || 0;
    // contrai a janela pela frente
    while (start < end && elapsed > windowSec) {
      const step = (samples[start + 1]?.t ?? samples[start].t) - samples[start].t;
      elapsed -= step / 1000;
      distance -= samples[start + 1]?.dist ?? 0;
      start += 1;
    }
    if (elapsed >= Math.min(windowSec, 20) && elapsed > 0) {
      const kmh = (distance / elapsed) * 3.6;
      if (kmh > best) best = kmh;
    }
  }
  return best;
}

/** Conta saltos fisicamente impossíveis entre amostras consecutivas. */
function countTeleports(samples: Sample[]): { hits: number; maxKmh: number } {
  let hits = 0;
  let maxKmh = 0;
  for (const s of samples) {
    if (s.dist >= TELEPORT_MIN_METERS && s.kmh > TELEPORT_KMH) {
      hits += 1;
      maxKmh = Math.max(maxKmh, s.kmh);
    }
  }
  return { hits, maxKmh };
}

/** Detecta partida de veículo: 0 → acima de X km/h em poucos segundos. */
function detectVehicleLaunch(samples: Sample[], thresholdKmh: number): { hits: number; maxKmh: number } {
  let hits = 0;
  let maxKmh = 0;
  for (let i = 1; i < samples.length; i += 1) {
    const dt = (samples[i].t - samples[i - 1].t) / 1000;
    if (dt <= 0 || dt > 8) continue;
    if (samples[i].kmh >= thresholdKmh && samples[i - 1].kmh <= 3) {
      hits += 1;
      maxKmh = Math.max(maxKmh, samples[i].kmh);
    }
  }
  return { hits, maxKmh };
}

function reasonFor(findings: IntegrityFinding[], sportKey: string): string | null {
  const label = FAMILY_LABEL[familyOf(sportKey)] ?? "modalidade";
  const vehicle = findings.find((f) => f.code === "vehicle_speed");
  const teleport = findings.find((f) => f.code === "teleport");
  const launch = findings.find((f) => f.code === "vehicle_acceleration");
  const degraded = findings.find((f) => f.code === "degraded_signal");

  if (vehicle) {
    return `Detectamos velocidade de ${Math.round(vehicle.observedKmh ?? 0)} km/h sustentada, incompatível com ${label} (limite ${SUSTAINED_LIMIT[familyOf(sportKey)]} km/h). Provável uso de veículo ou falha de GPS, então este percurso não conta para recompensas e rankings.`;
  }
  if (teleport && teleport.hits >= 2) {
    return `Detectamos ${teleport.hits} saltos impossíveis de distância no percurso (${Math.round(teleport.observedKmh ?? 0)} km/h entre amostras). Isso indica falha de GPS ou posição simulada, então este percurso não conta para recompensas e rankings.`;
  }
  if (launch && launch.hits >= 2) {
    return `Detectamos ${launch.hits} arrancadas típicas de veículo motorizado durante ${label}. Este percurso não conta para recompensas e rankings.`;
  }
  if (degraded && degraded.hits > 0) {
    return `A maior parte das leituras de GPS veio com precisão muito ruim (${degraded.hits} amostras descartadas). Não conseguimos validar este percurso, então ele não conta para recompensas e rankings.`;
  }
  return null;
}

/**
 * Veredito de integridade da atividade. Executa no servidor sobre os dados
 * enviados — e no cliente apenas para feedback imediato.
 */
export function evaluateIntegrity(sportKey: string, track: TrackPoint[], opts: { isIndoor?: boolean } = {}): IntegrityReport {
  const findings: IntegrityFinding[] = [];

  // Indoor (esteira/rolo) não tem GPS: nada a validar por trajeto.
  if (opts.isIndoor) {
    return {
      status: "valid",
      reason: null,
      findings: [],
      metrics: {
        maxSustainedKmh: 0,
        limitKmh: limitFor(sportKey),
        teleports: 0,
        lowAccuracyPoints: 0,
        analyzedPoints: 0,
        trustedDistanceM: 0,
      },
    };
  }

  const { samples, lowAccuracy } = buildSamples(track);
  const limit = limitFor(sportKey);
  const ceiling = absoluteCeiling(sportKey);
  const trustedDistanceM = samples.reduce((sum, s) => sum + s.dist, 0);

  const sustained = maxSustainedKmh(samples, SUSTAIN_WINDOW_SEC);

  // Sinal insuficiente: se praticamente nada sobrou após o filtro de precisão,
  // o percurso não pode ser validado — e não pode passar como válido.
  const usableRatio = track.length > 0 ? samples.length / track.length : 0;
  if (track.length >= 8 && samples.length < 4) {
    return finish("suspicious", [
      {
        code: "degraded_signal",
        message: `${lowAccuracy} de ${track.length} amostras descartadas por precisão ruim`,
        hits: lowAccuracy,
      },
    ], {
      maxSustainedKmh: 0,
      limitKmh: limit,
      teleports: 0,
      lowAccuracyPoints: lowAccuracy,
      analyzedPoints: samples.length,
      trustedDistanceM,
    }, sportKey);
  }
  // Proporção alta de amostras perdidas também compromete a confiabilidade.
  if (track.length >= 20 && usableRatio < 0.4) {
    return finish("suspicious", [
      {
        code: "degraded_signal",
        message: `Apenas ${Math.round(usableRatio * 100)}% das leituras de GPS tinham precisão utilizável`,
        hits: lowAccuracy,
      },
    ], {
      maxSustainedKmh: sustained,
      limitKmh: limit,
      teleports: 0,
      lowAccuracyPoints: lowAccuracy,
      analyzedPoints: samples.length,
      trustedDistanceM,
    }, sportKey);
  }

  // 1) Velocidade sustentada acima do teto da modalidade → trapaça clara.
  if (sustained > limit) {
    const severity: IntegrityStatus = sustained > ceiling ? "invalid" : "suspicious";
    findings.push({
      code: "vehicle_speed",
      message: `Velocidade sustentada de ${Math.round(sustained)} km/h acima do limite de ${limit} km/h`,
      observedKmh: sustained,
      hits: 1,
    });
    if (severity === "invalid") {
      return finish("invalid", findings, {
        maxSustainedKmh: sustained,
        limitKmh: limit,
        teleports: 0,
        lowAccuracyPoints: lowAccuracy,
        analyzedPoints: samples.length,
        trustedDistanceM,
      }, sportKey);
    }
  }

  // 2) Teleporte.
  const teleport = countTeleports(samples);
  if (teleport.hits > 0) {
    findings.push({
      code: "teleport",
      message: `${teleport.hits} saltos impossíveis de distância entre amostras`,
      observedKmh: teleport.maxKmh,
      hits: teleport.hits,
    });
  }

  // 3) Arrancada de veículo em modalidade a pé.
  if (familyOf(sportKey) !== "ride") {
    const launch = detectVehicleLaunch(samples, VEHICLE_ACCEL_KMH_PER_5S);
    if (launch.hits > 0) {
      findings.push({
        code: "vehicle_acceleration",
        message: `${launch.hits} arrancadas típicas de veículo motorizado`,
        observedKmh: launch.maxKmh,
        hits: launch.hits,
      });
    }
  }

  // 4) Sinal degradado: a maioria das amostras foi descartada por precisão.
  if (samples.length > 0 && lowAccuracy > samples.length * 1.5) {
    findings.push({
      code: "degraded_signal",
      message: `${lowAccuracy} amostras descartadas por precisão ruim`,
      hits: lowAccuracy,
    });
  }

  const hasSevere = findings.some(
    (f) => f.code === "vehicle_speed" || f.code === "teleport" || f.code === "vehicle_acceleration",
  );
  const status: IntegrityStatus = hasSevere ? "suspicious" : findings.length > 0 ? "suspicious" : "valid";

  return finish(status, findings, {
    maxSustainedKmh: sustained,
    limitKmh: limit,
    teleports: teleport.hits,
    lowAccuracyPoints: lowAccuracy,
    analyzedPoints: samples.length,
    trustedDistanceM,
  }, sportKey);
}

function finish(
  status: IntegrityStatus,
  findings: IntegrityFinding[],
  metrics: IntegrityReport["metrics"],
  sportKey: string,
): IntegrityReport {
  return { status, reason: reasonFor(findings, sportKey), findings, metrics };
}

/** Resumo curto para exibição na interface. */
export function integrityBadge(status: IntegrityStatus): { label: string; accent: string } {
  if (status === "valid") return { label: "Percurso validado", accent: "#d5ff45" };
  if (status === "suspicious") return { label: "Percurso não validado", accent: "#ff6a3d" };
  return { label: "Percurso inválido", accent: "#ff6a3d" };
}

/**
 * Filtra a trilha antes de persistir: descarta ruído de GPS e saltos
 * impossíveis, mantendo o registro limpo para cálculo de distância.
 */
export function sanitizeTrack(track: TrackPoint[], sportKey: string): { points: TrackPoint[]; discarded: number } {
  const ceiling = absoluteCeiling(sportKey);
  const kept: TrackPoint[] = [];
  let discarded = 0;

  for (const point of track) {
    if (typeof point.acc === "number" && point.acc > MAX_USABLE_ACCURACY) {
      discarded += 1;
      continue;
    }
    const prev = kept[kept.length - 1];
    if (prev) {
      const dt = (point.t - prev.t) / 1000;
      const dist = haversine(prev.lat, prev.lng, point.lat, point.lng);
      // Salto impossível: descarta o ponto, não o trajeto inteiro.
      if (dt > 0 && dist > 0 && (dist / dt) * 3.6 > TELEPORT_KMH && dist >= TELEPORT_MIN_METERS) {
        discarded += 1;
        continue;
      }
      // Ruído acima do teto físico da modalidade.
      if (dt > 0 && dist > 0 && (dist / dt) * 3.6 > ceiling * 1.4) {
        discarded += 1;
        continue;
      }
    }
    kept.push(point);
  }

  return { points: kept, discarded };
}
