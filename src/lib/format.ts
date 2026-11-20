export const WEIGHT_KG = 70;

export function haversine(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000;
  const toR = (d: number) => (d * Math.PI) / 180;
  const dLat = toR(b.lat - a.lat);
  const dLng = toR(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toR(a.lat)) * Math.cos(toR(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function calories(met: number, sec: number, kg = WEIGHT_KG) {
  return Math.round(met * kg * (sec / 3600));
}

export function fmtTime(sec: number) {
  sec = Math.max(0, Math.round(sec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const p = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${p(m)}:${p(s)}` : `${p(m)}:${p(s)}`;
}

export function fmtKm(m: number, digits = 2) {
  return (m / 1000).toFixed(digits);
}

export function fmtSpeed(ms: number) {
  return (ms * 3.6).toFixed(1);
}

export function fmtPace(ms: number) {
  if (!ms || ms < 0.3) return "--:--";
  const secPerKm = 1000 / ms;
  if (secPerKm > 3600) return "--:--";
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return `${m}:${String(s === 60 ? 0 : s).padStart(2, "0")}`;
}

export function fmtDate(d: string | Date) {
  return new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
