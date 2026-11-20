export type SportGroup = "corrida" | "caminhada" | "ciclismo" | "outros";
export type ExtraField = { key: string; label: string; type: "number" | "text" | "select"; options?: string[]; unit?: string };

export type Sport = {
  key: string;
  label: string;
  group: SportGroup;
  icon: string;
  met: number; // equivalente metabólico p/ calorias
  display: "pace" | "speed" | "time"; // métrica principal
  gps: boolean;
  autoPauseSpeed?: number; // m/s abaixo = pausa automática
  enabled: boolean; // modalidades futuras ficam preparadas mas desabilitadas
  extraFields?: ExtraField[];
};

const bikeFields: ExtraField[] = [
  { key: "bike", label: "Bicicleta", type: "text" },
  { key: "cadence", label: "Cadência média", type: "number", unit: "rpm" },
  { key: "power", label: "Potência média", type: "number", unit: "W" },
];
const runFields: ExtraField[] = [
  { key: "shoes", label: "Tênis", type: "text" },
  { key: "effort", label: "Esforço percebido", type: "select", options: ["Leve", "Moderado", "Forte", "Máximo"] },
];
const trailFields: ExtraField[] = [
  { key: "terrain", label: "Terreno", type: "select", options: ["Terra", "Pedras", "Lama", "Misto", "Areia"] },
  { key: "difficulty", label: "Dificuldade", type: "select", options: ["Fácil", "Moderada", "Difícil", "Extrema"] },
];

export const SPORTS: Sport[] = [
  { key: "run", label: "Corrida outdoor", group: "corrida", icon: "🏃", met: 9.8, display: "pace", gps: true, autoPauseSpeed: 0.6, enabled: true, extraFields: runFields },
  { key: "street_run", label: "Corrida de rua", group: "corrida", icon: "🏙️", met: 9.8, display: "pace", gps: true, autoPauseSpeed: 0.6, enabled: true, extraFields: runFields },
  { key: "trail_run", label: "Trail running", group: "corrida", icon: "⛰️", met: 10.5, display: "pace", gps: true, autoPauseSpeed: 0.5, enabled: true, extraFields: [...runFields, ...trailFields] },
  { key: "indoor_run", label: "Corrida indoor", group: "corrida", icon: "🏠", met: 9, display: "pace", gps: false, enabled: true, extraFields: [{ key: "incline", label: "Inclinação", type: "number", unit: "%" }, ...runFields] },
  { key: "walk", label: "Caminhada outdoor", group: "caminhada", icon: "🚶", met: 3.8, display: "pace", gps: true, autoPauseSpeed: 0.3, enabled: true },
  { key: "leisure_walk", label: "Caminhada recreativa", group: "caminhada", icon: "🌳", met: 3, display: "pace", gps: true, autoPauseSpeed: 0.3, enabled: true },
  { key: "long_walk", label: "Caminhada longa distância", group: "caminhada", icon: "🎒", met: 4.5, display: "pace", gps: true, autoPauseSpeed: 0.3, enabled: true },
  { key: "hike", label: "Trilha", group: "caminhada", icon: "🥾", met: 6, display: "pace", gps: true, autoPauseSpeed: 0.25, enabled: true, extraFields: trailFields },
  { key: "road_bike", label: "Pedal de estrada", group: "ciclismo", icon: "🚴", met: 8, display: "speed", gps: true, autoPauseSpeed: 1.2, enabled: true, extraFields: bikeFields },
  { key: "mtb", label: "Mountain bike", group: "ciclismo", icon: "🚵", met: 8.5, display: "speed", gps: true, autoPauseSpeed: 0.9, enabled: true, extraFields: [...bikeFields, ...trailFields] },
  { key: "urban_bike", label: "Ciclismo urbano", group: "ciclismo", icon: "🚲", met: 6, display: "speed", gps: true, autoPauseSpeed: 1, enabled: true, extraFields: bikeFields },
  { key: "gravel", label: "Gravel", group: "ciclismo", icon: "🛤️", met: 8, display: "speed", gps: true, autoPauseSpeed: 1, enabled: true, extraFields: bikeFields },
  { key: "ebike", label: "Bicicleta elétrica", group: "ciclismo", icon: "⚡", met: 4.5, display: "speed", gps: true, autoPauseSpeed: 1.2, enabled: true, extraFields: [...bikeFields, { key: "assist", label: "Nível de assistência", type: "select", options: ["Eco", "Tour", "Sport", "Turbo"] }] },
  // Arquitetura preparada para próximas modalidades
  { key: "gym", label: "Academia", group: "outros", icon: "🏋️", met: 5, display: "time", gps: false, enabled: false },
  { key: "weights", label: "Musculação", group: "outros", icon: "💪", met: 6, display: "time", gps: false, enabled: false },
  { key: "functional", label: "Treino funcional", group: "outros", icon: "🤸", met: 8, display: "time", gps: false, enabled: false },
  { key: "swim", label: "Natação", group: "outros", icon: "🏊", met: 7, display: "pace", gps: false, enabled: false },
  { key: "soccer", label: "Futebol", group: "outros", icon: "⚽", met: 7, display: "time", gps: true, enabled: false },
  { key: "skate", label: "Skate", group: "outros", icon: "🛹", met: 5, display: "speed", gps: true, enabled: false },
  { key: "inline", label: "Patins", group: "outros", icon: "⛸️", met: 7.5, display: "speed", gps: true, enabled: false },
  { key: "yoga", label: "Yoga", group: "outros", icon: "🧘", met: 2.5, display: "time", gps: false, enabled: false },
];

export const GROUPS: { key: SportGroup; label: string }[] = [
  { key: "corrida", label: "Corrida" },
  { key: "caminhada", label: "Caminhada" },
  { key: "ciclismo", label: "Ciclismo" },
  { key: "outros", label: "Em breve" },
];

export function getSport(key: string): Sport {
  return SPORTS.find((s) => s.key === key) ?? SPORTS[0];
}
