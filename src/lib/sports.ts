/**
 * Configuração central das modalidades esportivas.
 * Cada modalidade define seus próprios campos, métricas e fórmulas.
 */

export type SportCategory = "run" | "walk" | "ride" | "other";

export type SportMetric =
  | "distance"
  | "elapsed"
  | "moving"
  | "pace"
  | "speed"
  | "maxSpeed"
  | "elevGain"
  | "altitude"
  | "calories"
  | "cadence"
  | "splits";

export type SportDef = {
  key: string;
  label: string;
  short: string;
  emoji: string;
  category: SportCategory;
  color: string;
  /** Modalidade já disponível para gravação real. */
  available: boolean;
  outdoor: boolean;
  /** Usa pace (min/km) em vez de velocidade como métrica principal. */
  usesPace: boolean;
  /** Permite pausa automática (sensor de velocidade parado). */
  supportsAutoPause: boolean;
  /** Limiar de velocidade (km/h) abaixo do qual considera-se parado. */
  stopThresholdKmh: number;
  /** Limiar de velocidade máxima plausível (km/h) para descartar ruído de GPS. */
  plausibleMaxKmh: number;
  /** Equivalente metabólico base usado na estimativa de calorias. */
  metBase: number;
  metrics: SportMetric[];
  description: string;
};

const RUN_METRICS: SportMetric[] = ["distance", "elapsed", "moving", "pace", "elevGain", "altitude", "calories", "splits"];
const WALK_METRICS: SportMetric[] = ["distance", "elapsed", "moving", "pace", "elevGain", "altitude", "calories", "splits"];
const RIDE_METRICS: SportMetric[] = [
  "distance",
  "elapsed",
  "moving",
  "speed",
  "maxSpeed",
  "elevGain",
  "altitude",
  "calories",
  "splits",
];

export const SPORTS: Record<string, SportDef> = {
  run: {
    key: "run",
    label: "Corrida",
    short: "Corrida",
    emoji: "🏃",
    category: "run",
    color: "#c9ff4b",
    available: true,
    outdoor: true,
    usesPace: true,
    supportsAutoPause: true,
    stopThresholdKmh: 3,
    plausibleMaxKmh: 34,
    metBase: 9.8,
    metrics: RUN_METRICS,
    description: "Corrida outdoor com GPS, pace ao vivo e splits por quilômetro.",
  },
  run_street: {
    key: "run_street",
    label: "Corrida de rua",
    short: "Rua",
    emoji: "🛣️",
    category: "run",
    color: "#c9ff4b",
    available: true,
    outdoor: true,
    usesPace: true,
    supportsAutoPause: true,
    stopThresholdKmh: 3,
    plausibleMaxKmh: 34,
    metBase: 10,
    metrics: RUN_METRICS,
    description: "Treino e prova de rua, com ritmo alvo e splits.",
  },
  run_trail: {
    key: "run_trail",
    label: "Trail running",
    short: "Trail",
    emoji: "⛰️",
    category: "run",
    color: "#8ce99a",
    available: true,
    outdoor: true,
    usesPace: true,
    supportsAutoPause: true,
    stopThresholdKmh: 2.5,
    plausibleMaxKmh: 28,
    metBase: 11,
    metrics: RUN_METRICS,
    description: "Trilha com foco em elevação acumulada e altimetria.",
  },
  run_indoor: {
    key: "run_indoor",
    label: "Corrida indoor",
    short: "Indoor",
    emoji: "🏠",
    category: "run",
    color: "#59b7ff",
    available: true,
    outdoor: false,
    usesPace: true,
    supportsAutoPause: false,
    stopThresholdKmh: 0,
    plausibleMaxKmh: 34,
    metBase: 9.5,
    metrics: ["distance", "elapsed", "moving", "pace", "calories"],
    description: "Esteira ou trackttor: tempo, ritmo e calorias sem GPS.",
  },
  walk: {
    key: "walk",
    label: "Caminhada",
    short: "Caminhada",
    emoji: "🚶",
    category: "walk",
    color: "#59b7ff",
    available: true,
    outdoor: true,
    usesPace: true,
    supportsAutoPause: true,
    stopThresholdKmh: 2,
    plausibleMaxKmh: 12,
    metBase: 4.3,
    metrics: WALK_METRICS,
    description: "Caminhada outdoor leve, com histórico de pontos e calorias.",
  },
  walk_rec: {
    key: "walk_rec",
    label: "Caminhada recreativa",
    short: "Recreativa",
    emoji: "🌳",
    category: "walk",
    color: "#59b7ff",
    available: true,
    outdoor: true,
    usesPace: true,
    supportsAutoPause: true,
    stopThresholdKmh: 1.8,
    plausibleMaxKmh: 12,
    metBase: 3.8,
    metrics: WALK_METRICS,
    description: "Passeio, pet e caminhadas de lazer no parque.",
  },
  walk_long: {
    key: "walk_long",
    label: "Caminhada longa distância",
    short: "Longa",
    emoji: "🧭",
    category: "walk",
    color: "#59b7ff",
    available: true,
    outdoor: true,
    usesPace: true,
    supportsAutoPause: true,
    stopThresholdKmh: 2,
    plausibleMaxKmh: 12,
    metBase: 4.5,
    metrics: WALK_METRICS,
    description: "Caminhadas de longa distância, peregrinação e ultradistance.",
  },
  hike: {
    key: "hike",
    label: "Trilha / Hiking",
    short: "Trilha",
    emoji: "🥾",
    category: "walk",
    color: "#8ce99a",
    available: true,
    outdoor: true,
    usesPace: true,
    supportsAutoPause: true,
    stopThresholdKmh: 1.8,
    plausibleMaxKmh: 14,
    metBase: 6,
    metrics: WALK_METRICS,
    description: "Trilhas com altimetria, ganho acumulado e desafios de montanha.",
  },
  ride: {
    key: "ride",
    label: "Pedal de estrada",
    short: "Estrada",
    emoji: "🚴",
    category: "ride",
    color: "#ff7a3d",
    available: true,
    outdoor: true,
    usesPace: false,
    supportsAutoPause: true,
    stopThresholdKmh: 3.5,
    plausibleMaxKmh: 110,
    metBase: 8,
    metrics: RIDE_METRICS,
    description: "Pedal de estrada com velocidade média, máxima e altimetria.",
  },
  mtb: {
    key: "mtb",
    label: "Mountain bike",
    short: "MTB",
    emoji: "🚵",
    category: "ride",
    color: "#ff7a3d",
    available: true,
    outdoor: true,
    usesPace: false,
    supportsAutoPause: true,
    stopThresholdKmh: 3,
    plausibleMaxKmh: 80,
    metBase: 8.5,
    metrics: RIDE_METRICS,
    description: "MTB com ganho acumulado,Single track e recordes de subida.",
  },
  ride_urban: {
    key: "ride_urban",
    label: "Ciclismo urbano",
    short: "Urbano",
    emoji: "🚲",
    category: "ride",
    color: "#ff7a3d",
    available: true,
    outdoor: true,
    usesPace: false,
    supportsAutoPause: true,
    stopThresholdKmh: 3,
    plausibleMaxKmh: 70,
    metBase: 7,
    metrics: RIDE_METRICS,
    description: "Pedal urbano e bicicleta como transporte, com pausa automática.",
  },
  gravel: {
    key: "gravel",
    label: "Gravel",
    short: "Gravel",
    emoji: "🪨",
    category: "ride",
    color: "#ffa94d",
    available: true,
    outdoor: true,
    usesPace: false,
    supportsAutoPause: true,
    stopThresholdKmh: 3,
    plausibleMaxKmh: 90,
    metBase: 8.2,
    metrics: RIDE_METRICS,
    description: "Gravel, estradas de terra e longas distâncias off-road.",
  },
  ebike: {
    key: "ebike",
    label: "Bicicleta elétrica",
    short: "e-Bike",
    emoji: "⚡",
    category: "ride",
    color: "#ffd43b",
    available: true,
    outdoor: true,
    usesPace: false,
    supportsAutoPause: true,
    stopThresholdKmh: 3.5,
    plausibleMaxKmh: 60,
    metBase: 5.5,
    metrics: RIDE_METRICS,
    description: "e-Bike com estimativa de calorias ajustada ao suporte elétrico.",
  },
  ride_indoor: {
    key: "ride_indoor",
    label: "Pedal indoor",
    short: "Indoor",
    emoji: "🌀",
    category: "ride",
    color: "#59b7ff",
    available: true,
    outdoor: false,
    usesPace: false,
    supportsAutoPause: false,
    stopThresholdKmh: 0,
    plausibleMaxKmh: 80,
    metBase: 7.5,
    metrics: ["distance", "elapsed", "moving", "speed", "maxSpeed", "calories"],
    description: "Rolo ou indoor bike: tempo em movimento e velocidade simulada pelo sensor.",
  },
};

/** Arquitetura pronta para as próximas modalidades. */
export const UPCOMING_SPORTS: SportDef[] = [
  {
    key: "gym",
    label: "Academia",
    short: "Academia",
    emoji: "🏋️",
    category: "other",
    color: "#b197fc",
    available: false,
    outdoor: false,
    usesPace: false,
    supportsAutoPause: false,
    stopThresholdKmh: 0,
    plausibleMaxKmh: 0,
    metBase: 5,
    metrics: ["elapsed", "calories"],
    description: "Séries, cargas e volume total por sessão.",
  },
  {
    key: "strength",
    label: "Musculação",
    short: "Musculação",
    emoji: "💪",
    category: "other",
    color: "#b197fc",
    available: false,
    outdoor: false,
    usesPace: false,
    supportsAutoPause: false,
    stopThresholdKmh: 0,
    plausibleMaxKmh: 0,
    metBase: 5.5,
    metrics: ["elapsed", "calories"],
    description: "Grupos musculares, tonelagem e PRs por exercício.",
  },
  {
    key: "functional",
    label: "Treino funcional",
    short: "Funcional",
    emoji: "🤸",
    category: "other",
    color: "#b197fc",
    available: false,
    outdoor: false,
    usesPace: false,
    supportsAutoPause: false,
    stopThresholdKmh: 0,
    plausibleMaxKmh: 0,
    metBase: 6.5,
    metrics: ["elapsed", "calories"],
    description: "Circuitos, AMRAP e calorias por bloco.",
  },
  {
    key: "swim",
    label: "Natação",
    short: "Natação",
    emoji: "🏊",
    category: "other",
    color: "#4dabf7",
    available: false,
    outdoor: false,
    usesPace: false,
    supportsAutoPause: false,
    stopThresholdKmh: 0,
    plausibleMaxKmh: 0,
    metBase: 8.3,
    metrics: ["distance", "elapsed", "pace", "calories"],
    description: "Comprimentos, braçadas e swolf por piscina.",
  },
  {
    key: "soccer",
    label: "Futebol",
    short: "Futebol",
    emoji: "⚽",
    category: "other",
    color: "#69db7c",
    available: false,
    outdoor: true,
    usesPace: false,
    supportsAutoPause: false,
    stopThresholdKmh: 0,
    plausibleMaxKmh: 0,
    metBase: 7,
    metrics: ["elapsed", "distance", "calories"],
    description: "Distância percorrida em campo e sprints.",
  },
  {
    key: "skate",
    label: "Skate",
    short: "Skate",
    emoji: "🛹",
    category: "other",
    color: "#ffa8a8",
    available: false,
    outdoor: true,
    usesPace: false,
    supportsAutoPause: false,
    stopThresholdKmh: 0,
    plausibleMaxKmh: 0,
    metBase: 5,
    metrics: ["elapsed", "distance", "calories"],
    description: "Sessões, manobras e distância.",
  },
  {
    key: "skating",
    label: "Patins",
    short: "Patins",
    emoji: "⛸️",
    category: "other",
    color: "#74c0fc",
    available: false,
    outdoor: true,
    usesPace: false,
    supportsAutoPause: false,
    stopThresholdKmh: 0,
    plausibleMaxKmh: 0,
    metBase: 7,
    metrics: ["distance", "elapsed", "speed", "calories"],
    description: "Distância, velocidade e trajeto GPS.",
  },
  {
    key: "yoga",
    label: "Yoga",
    short: "Yoga",
    emoji: "🧘",
    category: "other",
    color: "#63e6be",
    available: false,
    outdoor: false,
    usesPace: false,
    supportsAutoPause: false,
    stopThresholdKmh: 0,
    plausibleMaxKmh: 0,
    metBase: 3,
    metrics: ["elapsed", "calories"],
    description: "Sessões, estilo e minutos de prática.",
  },
];

export const SPORT_GROUPS: { key: SportCategory; label: string; emoji: string; sports: SportDef[] }[] = [
  { key: "run", label: "Corrida", emoji: "🏃", sports: Object.values(SPORTS).filter((s) => s.category === "run") },
  { key: "walk", label: "Caminhada e trilha", emoji: "🥾", sports: Object.values(SPORTS).filter((s) => s.category === "walk") },
  { key: "ride", label: "Ciclismo e pedal", emoji: "🚴", sports: Object.values(SPORTS).filter((s) => s.category === "ride") },
];

export function getSport(key: string | null | undefined): SportDef {
  if (!key) return SPORTS.run;
  return SPORTS[key] ?? SPORTS.run;
}

export function sportLabel(key: string | null | undefined): string {
  return getSport(key).label;
}

export function isRideSport(key: string | null | undefined): boolean {
  return getSport(key).category === "ride";
}

export function categoryLabel(category: SportCategory): string {
  if (category === "ride") return "Ciclismo";
  if (category === "run") return "Corrida";
  if (category === "walk") return "Caminhada";
  return "Outros";
}

/** Calorias estimadas: MET ajustado pela intensidade real do treino. */
export function calcCalories(sportKey: string, distanceM: number, movingSec: number, weightKg = 72): number {
  const sport = getSport(sportKey);
  if (movingSec <= 0) return 0;
  const hours = movingSec / 3600;
  let met = sport.metBase;
  if (sport.category === "run" || sport.category === "walk") {
    const kmh = distanceM / 1000 / hours;
    if (sport.category === "run") met = kmh > 0 ? 1.05 * kmh + 1.2 : sport.metBase;
    else met = kmh > 0 ? 1.35 * kmh + 0.6 : sport.metBase;
    met = Math.min(met, 26);
  } else if (sport.category === "ride") {
    const kmh = distanceM / 1000 / hours;
    if (sport.key === "ebike") met = 3.5 + kmh * 0.16;
    else met = 3.5 + kmh * 0.42;
    met = Math.min(met, 18);
  }
  return Math.round(met * weightKg * hours);
}

export function defaultActivityName(sportKey: string): string {
  const sport = getSport(sportKey);
  const period = new Date().getHours();
  if (period < 12) return `${sport.label} matinal`;
  if (period < 18) return `${sport.label} de tarde`;
  return `${sport.label} noturna`;
}
