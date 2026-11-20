/** Níveis e progressão de XP — helpers puros, seguros para o bundle do cliente. */
export type LevelDef = { level: number; title: string; minXp: number };

export const LEVELS: LevelDef[] = [
  { level: 1, title: "Nômade", minXp: 0 },
  { level: 2, title: "Explorador", minXp: 600 },
  { level: 3, title: "Atleta", minXp: 1800 },
  { level: 4, title: "Guia de Trilha", minXp: 4000 },
  { level: 5, title: "Alfa", minXp: 7500 },
  { level: 6, title: "Lenda", minXp: 13000 },
  { level: 7, title: "Mítico", minXp: 22000 },
  { level: 8, title: "Imortal", minXp: 36000 },
];

export function levelFromXp(xp: number): {
  level: number;
  title: string;
  next: LevelDef | null;
  pct: number;
  intoLevel: number;
  span: number;
} {
  let current = LEVELS[0];
  for (const l of LEVELS) if (xp >= l.minXp) current = l;
  const idx = LEVELS.indexOf(current);
  const next = LEVELS[idx + 1] ?? null;
  const span = next ? next.minXp - current.minXp : 1;
  const intoLevel = xp - current.minXp;
  return {
    level: current.level,
    title: current.title,
    next,
    pct: next ? Math.min(100, Math.round((intoLevel / span) * 100)) : 100,
    intoLevel,
    span,
  };
}
