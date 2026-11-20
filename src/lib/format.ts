export function formatDistance(meters: number | null | undefined, digits?: number): string {
  const m = meters ?? 0;
  if (m < 1000) return `${Math.round(m)} m`;
  const km = m / 1000;
  const d = digits ?? (km < 10 ? 2 : km < 100 ? 1 : 0);
  return `${km.toFixed(d)} km`;
}

export function formatKmNumber(meters: number | null | undefined, digits = 2): string {
  return ((meters ?? 0) / 1000).toFixed(digits);
}

/** 3725 -> "1:02:05" | 725 -> "12:05" */
export function formatDuration(seconds: number | null | undefined, forceHours = false): string {
  const total = Math.max(0, Math.round(seconds ?? 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0 || forceHours) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Pace em min/km -> "5:12" */
export function formatPace(secPerKm: number | null | undefined): string {
  const s = Math.round(secPerKm ?? 0);
  if (!Number.isFinite(s) || s <= 0 || s > 36000) return "--:--";
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export function formatSpeed(kmh: number | null | undefined, digits = 1): string {
  const v = kmh ?? 0;
  if (!Number.isFinite(v) || v <= 0) return "0,0";
  return v.toFixed(digits).replace(".", ",");
}

export function formatElevation(meters: number | null | undefined): string {
  return `${Math.round(meters ?? 0)}`;
}

export function formatNumber(value: number | null | undefined, digits = 0): string {
  return (value ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function timeAgo(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  const diff = Date.now() - d.getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h`;
  const days = Math.round(h / 24);
  if (days < 7) return `${days} d`;
  const weeks = Math.round(days / 7);
  if (weeks < 5) return `${weeks} sem`;
  return formatDate(d);
}

export function relativeDayLabel(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  const yesterday = new Date(today.getTime() - 86400000);
  if (isToday) return "Hoje";
  if (d.toDateString() === yesterday.toDateString()) return "Ontem";
  return d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "short" });
}

export function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function pct(value: number, target: number): number {
  if (target <= 0) return 0;
  return Math.min(100, Math.round((value / target) * 100));
}

export const AVATAR_COLORS: Record<string, string> = {
  volt: "#c9ff4b",
  flame: "#ff7a3d",
  sky: "#59b7ff",
  mint: "#63e6be",
  grape: "#b197fc",
  sun: "#ffd43b",
  rose: "#ff8fa3",
};

export function avatarColor(key: string | null | undefined): string {
  return AVATAR_COLORS[key ?? "volt"] ?? "#c9ff4b";
}
