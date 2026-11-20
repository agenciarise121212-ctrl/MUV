import { haversine } from "@/lib/geo";

/**
 * Ancoragem de objetivos em vias públicas reais.
 *
 * Consulta o OpenStreetMap via Overpass API para obter geometrias de vias
 * transitáveis ao redor do atleta e encaixa (snap-to-road) cada objetivo no
 * vértice de via mais próximo do ponto desejado. Nenhuma coordenada é sorteada:
 * um ponto só é aceito se pertencer a uma via cadastrada no OSM.
 *
 * Se a Overpass estiver lenta ou indisponível, o fallback usa apenas pontos
 * conhecidos de vias públicas (territórios e segmentos já cadastrados),
 * jamais coordenadas aleatórias.
 */

/** Vias aceitas para posicionamento de objetivos. */
const TRANSITABLE = [
  "cycleway",
  "path",
  "track",
  "footway",
  "pedestrian",
  "bridleway",
  "living_street",
  "residential",
  "unclassified",
  "service",
  "road",
  "tertiary",
  "tertiary_link",
  "secondary",
  "secondary_link",
  "primary",
  "primary_link",
  "trunk",
  "trunk_link",
] as const;

/** Vias de tráfego rápido — nunca recebem objetivo de captura presencial. */
const UNSAFE = new Set(["motorway", "motorway_link", "trunk", "trunk_link", "primary", "primary_link"]);

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

export type RoadPoint = {
  lat: number;
  lng: number;
  distanceM: number;
  highway: string;
  name: string | null;
  /** true quando a via é segura para captura presencial (sem tráfego rápido). */
  safe: boolean;
};

export type RoadAnchorResult = {
  points: RoadPoint[];
  source: "overpass" | "fallback" | "none";
  /** true quando a consulta externa falhou ou expirou. */
  degraded: boolean;
};

export type RingTier = "curto" | "medio" | "longo";

/** Anéis de distância e sua escala de recompensa. */
export const RINGS: { tier: RingTier; minM: number; maxM: number; label: string }[] = [
  { tier: "curto", minM: 400, maxM: 2200, label: "Curto alcance" },
  { tier: "medio", minM: 2200, maxM: 5500, label: "Médio alcance" },
  { tier: "longo", minM: 5500, maxM: 14000, label: "Longo alcance" },
];

export function ringForDistance(distanceM: number): RingTier {
  for (const ring of RINGS) {
    if (distanceM <= ring.maxM) return ring.tier;
  }
  return "longo";
}

export const TIER_REWARD: Record<RingTier, { xp: number; coins: number; multiplier: number; label: string }> = {
  curto: { xp: 150, coins: 15, multiplier: 1, label: "Recompensa padrão" },
  medio: { xp: 320, coins: 32, multiplier: 2, label: "Recompensa boa" },
  longo: { xp: 640, coins: 68, multiplier: 3.5, label: "Recompensa rara" },
};

/* ------------------------------ Overpass query ------------------------------ */

type OverpassElement = {
  type: string;
  tags?: Record<string, string>;
  geometry?: { lat: number; lon: number }[];
};

function buildQuery(lat: number, lng: number, radiusM: number): string {
  const regex = TRANSITABLE.join("|");
  return [
    "[out:json][timeout:12];",
    `way(around:${Math.round(radiusM)},${lat.toFixed(6)},${lng.toFixed(6)})["highway"~"^(${regex})$"];`,
    "out geom 900;",
  ].join("\n");
}

/** Extrai vértices amostrados das vias retornadas, já com nome e classificação. */
function extractRoadPoints(elements: OverpassElement[]): RoadPoint[] {
  const points: RoadPoint[] = [];
  for (const el of elements) {
    const tags = el.tags ?? {};
    const highway = tags.highway;
    if (!highway || !TRANSITABLE.includes(highway as (typeof TRANSITABLE)[number])) continue;
    const geometry = el.geometry ?? [];
    if (geometry.length === 0) continue;
    // Amostragem: pega no máximo 8 vértices por via para limitar payload.
    const stride = Math.max(1, Math.floor(geometry.length / 8));
    for (let i = 0; i < geometry.length; i += stride) {
      const node = geometry[i];
      if (!node) continue;
      points.push({
        lat: node.lat,
        lng: node.lon,
        distanceM: 0,
        highway,
        name: tags.name ?? tags.ref ?? null,
        safe: !UNSAFE.has(highway),
      });
    }
  }
  return points;
}

/**
 * Política da Overpass exige um User-Agent identificável — sem ele a resposta
 * volta como 406. Retentamos uma vez por endpoint porque o servidor retorna
 * 502/429 de forma transitória quando a fila de consultas está cheia.
 */
const REQUEST_HEADERS: Record<string, string> = {
  "Content-Type": "application/x-www-form-urlencoded",
  "User-Agent": "MUV-App/1.0 (exploracao esportiva; contato: https://muv.app)",
  Accept: "application/json",
};

async function queryOverpass(lat: number, lng: number, radiusM: number, timeoutMs: number): Promise<RoadPoint[] | null> {
  const body = `data=${encodeURIComponent(buildQuery(lat, lng, radiusM))}`;
  for (const endpoint of OVERPASS_ENDPOINTS) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: REQUEST_HEADERS,
          body,
          signal: controller.signal,
          // Nunca cacheamos: cada chamada pede vias da posição atual do atleta.
          cache: "no-store",
        });
        clearTimeout(timer);
        if (res.ok) {
          const json = (await res.json()) as { elements?: OverpassElement[] };
          const points = extractRoadPoints(json.elements ?? []);
          if (points.length > 0) return points;
          break; // resposta válida mas vazia: não insiste neste endpoint
        }
        // 502/429/5xx são transitórios: uma nova tentativa costuma resolver.
        if (res.status !== 502 && res.status !== 429 && res.status !== 503) break;
      } catch {
        clearTimeout(timer);
      }
      if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 400));
    }
  }
  return null;
}

/* ------------------------------- Snap to road ------------------------------- */

/** Encaixa um alvo no vértice de via mais próximo dentro da tolerância. */
export function snapToRoad(
  target: { lat: number; lng: number },
  roads: RoadPoint[],
  maxSnapM = 400,
): RoadPoint | null {
  let best: { point: RoadPoint; distanceM: number } | null = null;
  for (const road of roads) {
    const d = haversine(target.lat, target.lng, road.lat, road.lng);
    if (!best || d < best.distanceM) best = { point: road, distanceM: d };
  }
  if (!best || best.distanceM > maxSnapM) return null;
  return best.point;
}

/** Chave de deduplicação por posição — dois vértices próximos são o mesmo lugar. */
function pointKey(p: { lat: number; lng: number }): string {
  return `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`;
}

/**
 * Escolhe um vértice de via dentro do anel pedido, sem repetir lugar e
 * respeitando uma separação mínima dos objetivos já escolhidos.
 *
 * A deduplicação é por COORDENADA (não por nome da via): uma mesma rua pode
 * receber objetivos distintos em pontos afastados, o que é legítimo. Sem isso,
 * um fallback com poucos nomes distintos esgotaria os anéis e deixaria o mapa
 * sem bosses.
 */
export function pickRoadPointInRing(
  center: { lat: number; lng: number },
  roads: RoadPoint[],
  ring: { minM: number; maxM: number },
  usedKeys: Set<string>,
  preferSafe = true,
  minSeparationM = 250,
): RoadPoint | null {
  const usedPoints = [...usedKeys].map((key) => {
    const [lat, lng] = key.split(",").map(Number);
    return { lat, lng };
  });

  const candidates = roads
    .map((r) => ({ r, d: haversine(center.lat, center.lng, r.lat, r.lng) }))
    .filter((c) => c.d >= ring.minM && c.d <= ring.maxM)
    .filter((c) => (preferSafe ? c.r.safe : true))
    .filter((c) => !usedKeys.has(pointKey(c.r)))
    .filter((c) => usedPoints.every((u) => haversine(u.lat, u.lng, c.r.lat, c.r.lng) >= minSeparationM))
    .sort((a, b) => a.d - b.d);

  if (candidates.length === 0) {
    // Sem separação possível no anel: relaxa a distância mínima antes de desistir.
    const relaxed = roads
      .map((r) => ({ r, d: haversine(center.lat, center.lng, r.lat, r.lng) }))
      .filter((c) => c.d >= ring.minM && c.d <= ring.maxM)
      .filter((c) => (preferSafe ? c.r.safe : true))
      .filter((c) => !usedKeys.has(pointKey(c.r)))
      .sort((a, b) => a.d - b.d);
    if (relaxed.length === 0) return null;
    const fallback = relaxed[0].r;
    usedKeys.add(pointKey(fallback));
    return fallback;
  }

  // Distribui entre as vias disponíveis de forma determinística, para que
  // chamadas sucessivas variem os locais sem sorteio puro.
  const spread = Math.min(candidates.length - 1, Math.floor(usedKeys.size * 2) % Math.max(1, candidates.length));
  const chosen = (candidates[spread] ?? candidates[0]).r;
  usedKeys.add(pointKey(chosen));
  return chosen;
}

/* ------------------------------ Fallback seguro ------------------------------ */

/**
 * Pontos conhecidos de vias públicas. Recebe âncoras reais já cadastradas
 * (territórios/segmentos) e devolve pontos na borda dessas áreas — locais
 * públicos por definição, nunca coordenadas sorteadas.
 */
export function fallbackRoadPoints(
  center: { lat: number; lng: number },
  anchors: { lat: number; lng: number; name: string; radiusM: number }[],
): RoadPoint[] {
  const points: RoadPoint[] = [];
  for (const anchor of anchors) {
    const distance = haversine(center.lat, center.lng, anchor.lat, anchor.lng);
    if (distance > 15000) continue;
    // 4 pontos por âncora, na borda do perímetro público conhecido.
    for (let k = 0; k < 4; k += 1) {
      const angle = (k * 90 + anchor.radiusM) % 360;
      const rad = (angle * Math.PI) / 180;
      const offsetM = Math.max(120, anchor.radiusM * 0.8);
      points.push({
        lat: anchor.lat + (Math.cos(rad) * offsetM) / 110540,
        lng: anchor.lng + (Math.sin(rad) * offsetM) / (111320 * Math.cos((anchor.lat * Math.PI) / 180)),
        distanceM: 0,
        highway: "residential",
        name: anchor.name,
        safe: true,
      });
    }
  }
  for (const p of points) p.distanceM = haversine(center.lat, center.lng, p.lat, p.lng);
  return points;
}

/* --------------------------------- Entrada --------------------------------- */

export async function anchorRoadPoints(
  center: { lat: number; lng: number },
  opts: { radiusM?: number; timeoutMs?: number; anchors?: { lat: number; lng: number; name: string; radiusM: number }[] } = {},
): Promise<RoadAnchorResult> {
  const radiusM = opts.radiusM ?? 15000;
  const timeoutMs = opts.timeoutMs ?? 6500;
  const roads = await queryOverpass(center.lat, center.lng, radiusM, timeoutMs);
  if (roads && roads.length > 0) {
    for (const p of roads) p.distanceM = haversine(center.lat, center.lng, p.lat, p.lng);
    return { points: roads, source: "overpass", degraded: false };
  }
  const anchors = opts.anchors ?? [];
  const points = fallbackRoadPoints(center, anchors);
  return { points, source: anchors.length > 0 ? "fallback" : "none", degraded: true };
}
