import { getSport } from "./sports";
import type { TrackPoint } from "@/db/schema";

type A = {
  id: number; sport: string; distanceM: number; elevGainM: number; movingSec: number; elapsedSec: number;
  maxSpeed: number; avgSpeed: number; startedAt: Date; points: TrackPoint[]; calories: number; integrity?: string;
};
// atividades suspeitas não contam para XP, conquistas, desafios, territórios ou recordes
const fair = (acts: A[]) => acts.filter((a) => a.integrity !== "suspect");

export function territories(acts: A[]) {
  acts = fair(acts);
  // célula ~ 0.005° (~550m). Cada célula visitada = território conquistado
  const cells = new Set<string>();
  for (const a of acts) for (const p of a.points ?? []) cells.add(`${Math.floor(p.lat / 0.005)}:${Math.floor(p.lng / 0.005)}`);
  return cells.size;
}

export function achievements(acts: A[]) {
  acts = fair(acts);
  const total = (g?: string) => acts.filter((a) => !g || getSport(a.sport).group === g).reduce((s, a) => s + a.distanceM, 0);
  const maxOf = (g: string, f: (a: A) => number) => Math.max(0, ...acts.filter((a) => getSport(a.sport).group === g).map(f));
  const elev = acts.reduce((s, a) => s + a.elevGainM, 0);
  const list = [
    { icon: "flag", name: "Primeira atividade", done: acts.length >= 1 },
    { icon: "bolt", name: "10 atividades", done: acts.length >= 10 },
    { icon: "run", name: "Primeiros 5 km correndo", done: maxOf("corrida", (a) => a.distanceM) >= 5000 },
    { icon: "medal", name: "10 km numa corrida", done: maxOf("corrida", (a) => a.distanceM) >= 10000 },
    { icon: "trophy", name: "Meia maratona", done: maxOf("corrida", (a) => a.distanceM) >= 21097 },
    { icon: "road_bike", name: "Pedal de 20 km", done: maxOf("ciclismo", (a) => a.distanceM) >= 20000 },
    { icon: "gravel", name: "Pedal de 100 km", done: maxOf("ciclismo", (a) => a.distanceM) >= 100000 },
    { icon: "bolt", name: "40 km/h no pedal", done: maxOf("ciclismo", (a) => a.maxSpeed) >= 40 / 3.6 },
    { icon: "hike", name: "Trilheiro: 10 km caminhando", done: maxOf("caminhada", (a) => a.distanceM) >= 10000 },
    { icon: "mountain", name: "1.000 m de elevação total", done: elev >= 1000 },
    { icon: "pin", name: "Conquistou 25 territórios", done: territories(acts) >= 25 },
    { icon: "route", name: "100 km acumulados", done: total() >= 100000 },
  ];
  return list;
}

export function challenges(acts: A[]) {
  acts = fair(acts);
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const month = acts.filter((a) => new Date(a.startedAt) >= monthStart);
  const by = (g: string) => month.filter((a) => getSport(a.sport).group === g);
  const sum = (arr: A[], f: (a: A) => number) => arr.reduce((s, a) => s + f(a), 0);
  return [
    { icon: "run", name: "Corra 50 km no mês", progress: sum(by("corrida"), (a) => a.distanceM) / 1000, goal: 50, unit: "km", reward: "Medalha Corredor do Mês" },
    { icon: "road_bike", name: "Pedale 200 km no mês", progress: sum(by("ciclismo"), (a) => a.distanceM) / 1000, goal: 200, unit: "km", reward: "Medalha Giro Mensal" },
    { icon: "mountain", name: "Escale 2.000 m no mês", progress: sum(month, (a) => a.elevGainM), goal: 2000, unit: "m", reward: "Medalha Escalador" },
    { icon: "walk", name: "Caminhe 30 km no mês", progress: sum(by("caminhada"), (a) => a.distanceM) / 1000, goal: 30, unit: "km", reward: "Medalha Explorador" },
    { icon: "target", name: "12 atividades no mês", progress: month.length, goal: 12, unit: "ativ.", reward: "Medalha Constância" },
  ];
}

export function personalRecords(acts: A[], group: string) {
  acts = fair(acts);
  const g = acts.filter((a) => getSport(a.sport).group === group);
  const best = (f: (a: A) => number) => g.reduce<A | null>((b, a) => (!b || f(a) > f(b) ? a : b), null);
  return {
    longest: best((a) => a.distanceM),
    fastestAvg: best((a) => (a.distanceM > 1000 ? a.avgSpeed : 0)),
    maxSpeed: best((a) => a.maxSpeed),
    mostElev: best((a) => a.elevGainM),
    longestTime: best((a) => a.movingSec),
    count: g.length,
  };
}

// Nível: XP derivado de distância, elevação, atividades e conquistas reais
export function level(acts: A[], bonusXp = 0) {
  acts = fair(acts);
  const km = acts.reduce((s, a) => s + a.distanceM, 0) / 1000;
  const elev = acts.reduce((s, a) => s + a.elevGainM, 0);
  const ach = achievements(acts).filter((x) => x.done).length;
  const xp = Math.round(km * 10 + elev / 5 + acts.length * 20 + ach * 100 + bonusXp); // bonusXp = livro-razão de missões
  const lvl = Math.floor(Math.sqrt(xp / 100)) + 1;
  const cur = (lvl - 1) ** 2 * 100, next = lvl ** 2 * 100;
  return { level: lvl, xp, cur, next, pct: Math.min(100, ((xp - cur) / (next - cur)) * 100) };
}
