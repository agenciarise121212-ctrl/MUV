"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type * as L from "leaflet";
import Icon from "@/components/Icon";
import BottomSheet from "@/components/BottomSheet";
import EmblemIcon, { Coin3D, Xp3D } from "@/components/EmblemIcon";
import { BOSS_STYLE, emblemDef } from "@/lib/emblems";
import { fmtDate, fmtKm, fmtPace, fmtSpeed, fmtTime, haversine } from "@/lib/format";
import type { MissionReq } from "@/db/schema";
import { fetchJson } from "@/lib/http";
import { compressImage } from "@/lib/image";

export type MapAct = { id: number; title: string; sport: string; group: string; label: string; distanceM: number; movingSec: number; avgSpeed: number; elevGainM: number; startedAt: string; photo: number | null; points: [number, number][] };
export type MapMission = {
  id: number; type: string; category: string | null; title: string; description: string; emblem: string; lat: number | null; lng: number | null; radiusM: number;
  difficulty: number; xp: number; coins: number; item: string | null; status: string; req: MissionReq; progress: { visited?: number[]; meters?: number }; hp: number | null; hpMax: number | null; verified: boolean;
  tier?: string | null; template?: string | null; expiresAt?: string | null;
};
type Special = { count: number; need: number; active: boolean; ready: boolean };
const TIER_LABEL: Record<string, string> = { short: "Curto alcance", medium: "Médio alcance", long: "Longo alcance" };
const ROAD_Q = (lat: number, lng: number, r: number) => `[out:json][timeout:20];way(around:${r},${lat},${lng})[highway~"^(residential|living_street|unclassified|tertiary|secondary|tertiary_link|secondary_link|pedestrian|cycleway|footway|path|track|service)$"];out geom 400;`;
async function queryRoads(lat: number, lng: number) {
  for (const ep of ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"]) {
    try { const r = await fetch(ep, { method: "POST", body: "data=" + encodeURIComponent(ROAD_Q(lat, lng, 5000)), headers: { "Content-Type": "application/x-www-form-urlencoded" }, signal: AbortSignal.timeout(12000) }); if (r.ok) return ((await r.json()).elements ?? []) as unknown[]; } catch {}
  }
  return []; // servidor tenta de novo e usa cache/histórico de vias
}
function left(iso?: string | null, now = Date.now()) {
  if (!iso) return null; const ms = new Date(iso).getTime() - now; if (ms <= 0) return "expirado";
  const h = Math.floor(ms / 3600e3), m = Math.floor((ms % 3600e3) / 60e3); return h >= 24 ? `${Math.floor(h / 24)}d ${h % 24}h` : h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${m} min`;
}
const objective = (m: MapMission) => m.type === "boss" ? "Cumpra os desafios reais para zerar o HP" : m.type === "route" || m.type === "trail" ? "Passe pelos checkpoints na ordem, gravando a atividade" : m.type === "distance" || m.type === "endurance" ? `Percorrer ${((m.req.distanceM ?? 0) / 1000).toFixed(0)} km em uma atividade` : m.type === "photo" ? "Chegar a até 80 m e tirar uma foto real pelo app" : m.type === "climb" ? "Alcançar o ponto mais alto marcado" : "Chegar ao local e capturar parado";
type Wallet = { xp: number; coins: number };
type Layers = { routes: boolean; territories: boolean; starts: boolean; relief: boolean };

const TYPE_LABEL: Record<string, string> = { photo: "Check-in fotográfico", exploration: "Exploração", chest: "Baú de recompensa", collectible: "Colecionável", secret: "Missão secreta", climb: "Subida", trail: "Trilha", route: "Percurso", boss: "Boss", distance: "Distância", endurance: "Resistência" };
const STATUS_LABEL: Record<string, string> = { available: "Disponível", unlocked: "Desbloqueada", in_progress: "Em andamento", paused: "Pausada", completed: "Concluída" };
const FILTERS = [{ k: "all", l: "Tudo" }, { k: "missions", l: "Missões" }, { k: "chest", l: "Baús" }, { k: "boss", l: "Boss" }, { k: "paths", l: "Percursos" }, { k: "done", l: "Concluídas" }];
const CAPTURABLE = ["exploration", "chest", "collectible", "secret", "climb", "boss", "photo"];
const LS = "muv-map-prefs";
const SECRET_REVEAL_M = 300;

const matches = (m: MapMission, f: string) =>
  f === "all" ? m.status !== "completed" : f === "done" ? m.status === "completed" : m.status === "completed" ? false :
  f === "missions" ? ["exploration", "climb", "secret", "collectible", "photo"].includes(m.type) : f === "chest" ? m.type === "chest" || m.type === "collectible" : f === "boss" ? m.type === "boss" : ["route", "trail"].includes(m.type);

async function queryOverpass(lat: number, lng: number, r: number) {
  const q = `[out:json][timeout:25];(node(around:${r},${lat},${lng})[tourism=viewpoint];node(around:${r},${lat},${lng})[natural=peak];node(around:${r},${lat},${lng})[historic][name];node(around:${r},${lat},${lng})[tourism=artwork];node(around:${r},${lat},${lng})[amenity=drinking_water];way(around:${r},${lat},${lng})[leisure=park][name];way(around:${r},${lat},${lng})[highway~"^(path|track|cycleway)$"][name];);out geom 150;`;
  for (const ep of ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"]) {
    try { const r2 = await fetch(ep, { method: "POST", body: "data=" + encodeURIComponent(q), headers: { "Content-Type": "application/x-www-form-urlencoded" } }); if (r2.ok) return (await r2.json()).elements as unknown[]; } catch {}
  }
  throw new Error("Não foi possível consultar o OpenStreetMap agora.");
}

export default function MapExplorer({ acts, territories, missions: initialMissions, wallet: initialWallet, special: initialSpecial }: { acts: MapAct[]; territories: [number, number][]; missions: MapMission[]; wallet: Wallet; special: Special }) {
  const [special, setSpecial] = useState(initialSpecial);
  const [now, setNow] = useState(() => Date.now());
  const spawnedAt = useRef<{ lat: number; lng: number; t: number } | null>(null);
  useEffect(() => { const i = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(i); }, []);
  const el = useRef<HTMLDivElement>(null);
  const st = useRef<{ L?: typeof L; map?: L.Map; base?: L.TileLayer; relief?: L.TileLayer; actLayer?: L.LayerGroup; misLayer?: L.LayerGroup; pathLayer?: L.LayerGroup; me?: L.CircleMarker; acc?: L.Circle; fitted?: boolean }>({});
  const [ready, setReady] = useState(false);
  const [zoomTick, setZoomTick] = useState(0);
  const [layers, setLayers] = useState<Layers>({ routes: true, territories: true, starts: false, relief: false });
  const [filter, setFilter] = useState("all");
  const [missions, setMissions] = useState(initialMissions);
  const [wallet, setWallet] = useState(initialWallet);
  const [selAct, setSelAct] = useState<MapAct | null>(null);
  const [selId, setSelId] = useState<number | null>(null);
  const [sheet, setSheet] = useState(false);
  const [pos, setPos] = useState<GeolocationPosition | null>(null);
  const [perm, setPerm] = useState<"unknown" | "prompt" | "granted" | "denied">("unknown");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [reward, setReward] = useState<{ emblem: string; title: string; xp: number; coins: number; item: string | null; boss?: boolean; hp?: number } | null>(null);
  const notified = useRef(new Set<number>());
  const watchId = useRef<number | null>(null);
  const radiusPref = useRef(35);

  useEffect(() => {
    try { const p = JSON.parse(localStorage.getItem(LS) || "null"); if (p?.layers) setLayers((l) => ({ ...l, ...p.layers })); if (p?.filter) setFilter(p.filter); } catch {}
    radiusPref.current = Number(localStorage.getItem("muv-capture-radius")) || 35;
    navigator.permissions?.query({ name: "geolocation" as PermissionName }).then((r) => { setPerm(r.state as typeof perm); if (r.state === "granted") startWatch(); }).catch(() => setPerm("prompt"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { localStorage.setItem(LS, JSON.stringify({ layers, filter })); }, [layers, filter]);

  const startWatch = useCallback(() => {
    if (!("geolocation" in navigator) || watchId.current != null) return;
    watchId.current = navigator.geolocation.watchPosition((p) => { setPos(p); setPerm("granted"); }, (e) => { if (e.code === 1) setPerm("denied"); }, { enableHighAccuracy: true, maximumAge: 3000, timeout: 20000 });
  }, []);
  useEffect(() => () => { if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current); }, []);

  // mapa base
  useEffect(() => {
    let cancelled = false;
    import("leaflet").then((mod) => {
      if (cancelled || !el.current || st.current.map) return;
      const Lf = (mod.default ?? mod) as typeof L;
      const map = Lf.map(el.current, { zoomControl: false, attributionControl: true }).setView([-15.78, -47.93], 4);
      const base = Lf.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap", className: "muv-dark-tiles" }).addTo(map);
      const relief = Lf.tileLayer("https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png", { maxZoom: 17, attribution: "© OpenTopoMap (CC-BY-SA)", className: "muv-relief-tiles" });
      st.current = { L: Lf, map, base, relief, actLayer: Lf.layerGroup().addTo(map), pathLayer: Lf.layerGroup().addTo(map), misLayer: Lf.layerGroup().addTo(map) };
      map.on("zoomend moveend", () => setZoomTick((t) => t + 1));
      setReady(true);
    });
    return () => { cancelled = true; st.current.map?.remove(); st.current = {}; };
  }, []);

  useEffect(() => { const { map, relief } = st.current; if (!ready || !map || !relief) return; if (layers.relief) relief.addTo(map); else relief.remove(); }, [ready, layers.relief]);

  // camada de atividades + territórios
  useEffect(() => {
    const { L: Lf, map, actLayer: g } = st.current;
    if (!ready || !Lf || !map || !g) return;
    g.clearLayers();
    if (layers.territories) for (const [y, x] of territories) Lf.rectangle([[y * 0.005, x * 0.005], [(y + 1) * 0.005, (x + 1) * 0.005]], { color: "#D5FF45", weight: 1, opacity: 0.45, fillColor: "#D5FF45", fillOpacity: 0.08, interactive: false }).addTo(g);
    const bounds = Lf.latLngBounds([]);
    for (const a of acts) {
      if (layers.routes) { const line = Lf.polyline(a.points, { color: "#F5F5F2", weight: 2.5, opacity: 0.55 }).addTo(g); Lf.polyline(a.points, { weight: 16, opacity: 0 }).on("click", () => setSelAct(a)).addTo(g); bounds.extend(line.getBounds()); }
      if (layers.starts) Lf.circleMarker(a.points[0], { radius: 5, color: "#101112", weight: 2, fillColor: "#F5F5F2", fillOpacity: 1 }).on("click", () => setSelAct(a)).addTo(g);
    }
    if (!st.current.fitted && bounds.isValid() && !pos) { map.fitBounds(bounds, { padding: [40, 40] }); st.current.fitted = true; }
  }, [ready, acts, territories, layers.routes, layers.territories, layers.starts, pos]);

  // posição atual
  useEffect(() => {
    const { L: Lf, map } = st.current;
    if (!ready || !Lf || !map || !pos) return;
    const ll: [number, number] = [pos.coords.latitude, pos.coords.longitude];
    if (!st.current.me) {
      st.current.acc = Lf.circle(ll, { radius: pos.coords.accuracy, color: "#D5FF45", weight: 1, fillOpacity: 0.08, interactive: false }).addTo(map);
      st.current.me = Lf.circleMarker(ll, { radius: 8, color: "#101112", weight: 3, fillColor: "#D5FF45", fillOpacity: 1, interactive: false }).addTo(map);
      map.setView(ll, 15); st.current.fitted = true;
    } else { st.current.me.setLatLng(ll); st.current.acc?.setLatLng(ll).setRadius(pos.coords.accuracy); }
  }, [ready, pos]);

  const here = pos ? { lat: pos.coords.latitude, lng: pos.coords.longitude } : null;
  const speed = pos?.coords.speed ?? null;
  const moving = speed != null && speed > 2.5;
  const distTo = useCallback((m: MapMission) => (here && m.lat != null && m.lng != null ? haversine(here, { lat: m.lat, lng: m.lng }) : null), [here]);
  const inRange = useCallback((m: MapMission) => { const d = distTo(m); return d != null && !!pos && d <= Math.max(m.radiusM, radiusPref.current) + Math.min(pos.coords.accuracy, 25); }, [distTo, pos]);
  const sel = missions.find((m) => m.id === selId) ?? null;

  // marcadores de missões com agrupamento por grade de pixels
  const visible = useMemo(() => missions.filter((m) => m.lat != null && matches(m, filter) && (!m.expiresAt || new Date(m.expiresAt).getTime() > now || m.status === "completed")), [missions, filter, now]);
  useEffect(() => {
    const { L: Lf, map, misLayer: g } = st.current;
    if (!ready || !Lf || !map || !g) return;
    g.clearLayers();
    const cells = new Map<string, MapMission[]>();
    const CELL = 64;
    for (const m of visible) { const p = map.latLngToContainerPoint([m.lat!, m.lng!]); const k = `${Math.floor(p.x / CELL)}:${Math.floor(p.y / CELL)}`; (cells.get(k) ?? cells.set(k, []).get(k)!).push(m); }
    for (const group of cells.values()) {
      if (group.length > 1 && map.getZoom() < 17) {
        const lat = group.reduce((s, m) => s + m.lat!, 0) / group.length, lng = group.reduce((s, m) => s + m.lng!, 0) / group.length;
        const hasBoss = group.some((m) => m.type === "boss");
        Lf.marker([lat, lng], { icon: Lf.divIcon({ className: "", iconSize: [46, 46], iconAnchor: [23, 23], html: `<div class="mk-cluster${hasBoss ? " mk-cluster-boss" : ""}"><img src="/api/emblem/${group[0].emblem}" alt=""/><span>${group.length}</span></div>` }) })
          .on("click", () => map.flyTo([lat, lng], Math.min(18, map.getZoom() + 2), { duration: 0.5 })).addTo(g);
        continue;
      }
      for (const m of group) {
        const d = distTo(m);
        const hidden = m.type === "secret" && m.status !== "completed" && (d == null || d > SECRET_REVEAL_M);
        const big = m.type === "boss";
        const size = big ? 76 : 50;
        const near = inRange(m) && m.status !== "completed";
        const filterCss = m.type === "boss" && m.category ? BOSS_STYLE[m.category]?.filter ?? "none" : "none";
        const html = hidden
          ? `<div class="mk mk-secret-hidden"><span>?</span></div>`
          : `<div class="mk ${big ? "mk-boss" : ""} ${near ? "mk-near" : ""} ${m.status === "completed" ? "mk-done" : ""} ${m.status === "in_progress" ? "mk-active" : ""}" style="--s:${size}px"><img src="/api/emblem/${m.emblem}" alt="" decoding="async" style="filter:${filterCss}"/>${m.expiresAt && m.type === "boss" && m.template === "boss-special" ? `<u class="mk-timer">${left(m.expiresAt, now)}</u>` : ""}${m.hpMax ? `<i class="mk-hp"><b style="width:${Math.round(((m.hp ?? 0) / m.hpMax) * 100)}%"></b></i>` : ""}</div>`;
        Lf.marker([m.lat!, m.lng!], { icon: Lf.divIcon({ className: "", iconSize: [size, size], iconAnchor: [size / 2, size * 0.9], html }), zIndexOffset: big ? 500 : near ? 400 : 0, keyboard: true, title: hidden ? "Missão secreta" : m.title })
          .on("click", () => { setSelId(m.id); setSelAct(null); }).addTo(g);
      }
    }
  }, [ready, visible, zoomTick, distTo, inRange, now]);

  // percurso da missão selecionada ou em andamento
  useEffect(() => {
    const { L: Lf, map, pathLayer: g } = st.current;
    if (!ready || !Lf || !map || !g) return;
    g.clearLayers();
    const shown = missions.filter((m) => (m.type === "route" || m.type === "trail") && m.status !== "completed" && (m.id === selId || m.status === "in_progress"));
    for (const m of shown) {
      const cps = m.req.checkpoints ?? [];
      const line: [number, number][] = m.req.path ?? cps.map((c) => [c.lat, c.lng]);
      Lf.polyline(line, { color: "#D5FF45", weight: 5, opacity: 0.95, dashArray: m.verified ? undefined : "8 8" }).addTo(g);
      cps.forEach((c, i) => {
        const ok = m.progress.visited?.includes(i);
        Lf.marker([c.lat, c.lng], { icon: Lf.divIcon({ className: "", iconSize: [36, 36], iconAnchor: [18, 32], html: `<div class="mk mk-cp ${ok ? "mk-done" : ""}" style="--s:36px"><img src="/api/emblem/flag-checkered-flame" alt=""/><em>${i + 1}</em></div>` }), interactive: false }).addTo(g);
      });
    }
  }, [ready, missions, selId]);

  // notificação discreta de proximidade (uma vez por missão), sem exigir olhar a tela
  useEffect(() => {
    if (!pos) return;
    const near = missions.find((m) => CAPTURABLE.includes(m.type) && m.status !== "completed" && m.status !== "paused" && inRange(m));
    if (near && !notified.current.has(near.id)) {
      notified.current.add(near.id);
      navigator.vibrate?.([60, 40, 60]);
      setMsg(moving ? `${TYPE_LABEL[near.type]} por perto — pare em local seguro para interagir` : `${TYPE_LABEL[near.type]} ao alcance`);
      setTimeout(() => setMsg(null), 5000);
    }
  }, [pos, missions, inRange, moving]);

  async function refresh() {
    const r = await fetchJson<{ missions: MapMission[]; wallet: Wallet; special?: Special }>("/api/geo/missions", { cache: "no-store" });
    if (r.ok) { const j = r.data; setMissions(j.missions); setWallet({ xp: j.wallet.xp, coins: j.wallet.coins }); if (j.special) setSpecial(j.special); }
  }

  const spawn = useCallback(async (p: GeolocationPosition, quiet = false) => {
    setBusy("spawn");
    try {
      const roads = await queryRoads(p.coords.latitude, p.coords.longitude);
      const r = await fetchJson<{ missions: MapMission[]; wallet: Wallet; special?: Special; created: number; reason?: string; error?: string }>("/api/geo/spawn", { json: { lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy, roads } });
      const j = (r.data ?? { error: r.ok ? undefined : r.error }) as { missions: MapMission[]; wallet: Wallet; special?: Special; created: number; reason?: string; error?: string };
      if (!r.ok && !j.error) j.error = r.error;
      if (r.ok) {
        setMissions(j.missions); setWallet(j.wallet); if (j.special) setSpecial(j.special);
        spawnedAt.current = { lat: p.coords.latitude, lng: p.coords.longitude, t: Date.now() };
        if (j.special?.active && !quiet && j.created) setMsg("Desafios atualizados nas vias ao seu redor");
        if (!j.created && j.reason) setMsg(j.reason);
      } else if (!quiet) setMsg(j.error ?? "Não foi possível atualizar os desafios.");
    } catch { if (!quiet) setMsg("Não foi possível atualizar os desafios agora."); }
    setBusy(null); setTimeout(() => setMsg(null), 5000);
  }, []);

  // spawn automático: primeira posição confiável, deslocamento > 1,5 km ou a cada 5 min (rotação/expiração)
  useEffect(() => {
    if (!pos || pos.coords.accuracy > 200 || busy === "spawn") return;
    const last = spawnedAt.current;
    const moved = last ? haversine(last, { lat: pos.coords.latitude, lng: pos.coords.longitude }) : Infinity;
    if (!last || moved > 1500 || Date.now() - last.t > 5 * 60e3) spawn(pos, !!last);
  }, [pos, spawn, busy]);

  async function generateHere() {
    if (!pos) { startWatch(); setMsg("Ative a localização para buscar missões reais ao seu redor."); return; }
    setBusy("gen"); setMsg(null);
    try {
      const elements = await queryOverpass(pos.coords.latitude, pos.coords.longitude, 3500);
      const r = await fetchJson<{ created: number }>("/api/geo/generate", { json: { lat: pos.coords.latitude, lng: pos.coords.longitude, acc: pos.coords.accuracy, elements } });
      if (!r.ok) throw new Error(r.error);
      const j = r.data;
      await refresh();
      setMsg(j.created ? `${j.created} objetivos encontrados em dados reais do mapa` : elements.length ? "Nenhum novo objetivo seguro encontrado nesta área." : "Sem dados confiáveis do OpenStreetMap nesta área.");
    } catch (e) { setMsg(e instanceof Error ? e.message : "Falha ao buscar missões."); }
    setBusy(null); setTimeout(() => setMsg(null), 6000);
  }

  async function doCapture(m: MapMission) {
    if (!pos) return;
    setBusy("cap");
    const r = await fetchJson<{ completed: boolean; xp: number; coins: number; item: string | null; boss?: boolean; hp?: number }>(`/api/geo/missions/${m.id}/capture`, { json: { lat: pos.coords.latitude, lng: pos.coords.longitude, acc: pos.coords.accuracy, speed: pos.coords.speed, radius: radiusPref.current } });
    setBusy(null);
    if (!r.ok) { setMsg(r.error); setTimeout(() => setMsg(null), 5000); return; }
    const j = r.data;
    navigator.vibrate?.(120);
    setReward({ emblem: m.emblem, title: j.completed ? m.title : `${m.title} — HP ${j.hp}/${m.hpMax}`, xp: j.completed ? j.xp : Math.round(m.xp * 0.15), coins: j.completed ? j.coins : 0, item: j.completed ? j.item : null, boss: j.boss, hp: j.hp });
    setSelId(null);
    if (j.completed && pos) spawn(pos, true); else refresh();
  }

  async function doPhotoCheckin(m: MapMission, file: File) {
    if (!pos) return;
    setBusy("cap");
    try {
      const data = await compressImage(file);
      const r = await fetchJson<{ completed: boolean; xp: number; coins: number; item: string | null }>(`/api/geo/missions/${m.id}/photo`, { json: { lat: pos.coords.latitude, lng: pos.coords.longitude, acc: pos.coords.accuracy, speed: pos.coords.speed, data } });
      setBusy(null);
      if (!r.ok) { setMsg(r.error); setTimeout(() => setMsg(null), 5000); return; }
      navigator.vibrate?.(120);
      setReward({ emblem: m.emblem, title: m.title, xp: r.data.xp, coins: r.data.coins, item: r.data.item });
      setSelId(null);
      spawn(pos, true);
    } catch (e) { setBusy(null); setMsg(e instanceof Error ? e.message : "Falha ao processar a foto."); }
  }

  async function setMissionState(m: MapMission, action: "start" | "pause" | "resume") {
    setBusy("state");
    await fetch(`/api/geo/missions/${m.id}/state`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
    setBusy(null); refresh();
  }

  const locate = () => { if (pos) st.current.map?.flyTo([pos.coords.latitude, pos.coords.longitude], 16, { duration: 0.8 }); else startWatch(); };
  const acc = pos?.coords.accuracy;
  const bars = !pos ? 0 : acc! <= 10 ? 3 : acc! <= 25 ? 2 : 1;
  const nearCount = here ? missions.filter((m) => m.status !== "completed" && m.lat != null && (distTo(m) ?? 1e9) < 4000).length : 0;
  const done = missions.filter((m) => m.status === "completed").length;
  const ctrl = "tap w-11 h-11 flex items-center justify-center bg-ink/90 backdrop-blur border border-line text-bone";

  return (
    <div className="fixed inset-x-0 mx-auto max-w-[480px] top-0 bottom-[calc(var(--nav-h)+env(safe-area-inset-bottom))] overflow-hidden">
      <div ref={el} className="absolute inset-0 bg-graphite z-0" />
      {!ready && <div className="absolute inset-0 skel" />}

      {/* topo: GPS + progresso + recompensas */}
      <div className="absolute inset-x-0 top-0 z-[500] px-3 flex items-center gap-2" style={{ paddingTop: "calc(env(safe-area-inset-top) + 10px)" }}>
        <div className="h-11 flex-1 min-w-0 flex items-center gap-2.5 px-3 bg-ink/90 backdrop-blur border border-line text-[12px]">
          <span className="flex items-end gap-[2px] h-3 shrink-0" aria-label={`GPS ${bars}/3`}>{[1, 2, 3].map((b) => <span key={b} className={`w-[3px] ${b <= bars ? "bg-lime" : "bg-line"} ${!pos && perm === "granted" ? "animate-pulse" : ""}`} style={{ height: b * 4 }} />)}</span>
          <span className="text-mute num shrink-0">{acc != null ? `±${Math.round(acc)}m` : "GPS"}</span>
          <span className="w-px h-4 bg-line shrink-0" />
          <span className="truncate"><span className="num">{done}</span><span className="text-mute">/{missions.length} concluídas</span></span>
        </div>
        <Link href="/missions?tab=recompensas" aria-label="Recompensas" className="tap h-11 px-2.5 flex items-center gap-1.5 bg-ink/90 backdrop-blur border border-line text-[12px] num shrink-0"><Xp3D size={16} />{wallet.xp}<Coin3D size={16} />{wallet.coins}</Link>
      </div>

      {/* filtros */}
      <div className="absolute inset-x-0 z-[500] px-3 flex gap-1.5 overflow-x-auto no-scrollbar" style={{ top: "calc(env(safe-area-inset-top) + 62px)" }}>
        {FILTERS.map((f) => <button key={f.k} onClick={() => setFilter(f.k)} className={`tap shrink-0 h-8 px-3 text-[12px] font-medium border ${filter === f.k ? "bg-bone text-ink border-bone" : "bg-ink/85 backdrop-blur text-bone border-line"}`}>{f.l}</button>)}
        <button onClick={() => setSheet(true)} aria-label="Camadas" className="tap shrink-0 h-8 w-9 flex items-center justify-center border bg-ink/85 backdrop-blur border-line"><Icon name="layers" size={16} /></button>
      </div>

      {/* aviso */}
      {msg && <div className="absolute left-3 right-3 z-[550] bg-bone text-ink text-[13px] font-medium px-3 py-2.5 rise" style={{ top: "calc(env(safe-area-inset-top) + 104px)", animationDuration: ".35s" }}>{msg}</div>}

      {/* permissão de localização explicada antes do pedido */}
      {perm !== "granted" && ready && (
        <div className="absolute left-3 right-3 z-[520] bg-ink/95 border border-line p-4" style={{ top: "calc(env(safe-area-inset-top) + 104px)" }}>
          <div className="flex gap-3"><EmblemIcon name="compass" size={44} /><div className="min-w-0"><div className="text-[14px] font-semibold">Ative sua localização</div><p className="text-[12px] text-mute mt-1 leading-snug">O MUV usa o GPS do aparelho para mostrar missões ao seu redor e confirmar que você realmente chegou até elas. Sua posição não é publicada.</p></div></div>
          {perm === "denied" ? <p className="text-[12px] text-mute mt-3">Permissão negada. Libere a localização nas configurações do navegador.</p> : <button onClick={startWatch} className="tap btn btn-lime btn-sm w-full mt-3">Permitir localização</button>}
        </div>
      )}

      {/* buscando desafios nas vias */}
      {busy === "spawn" && !msg && (
        <div className="absolute left-3 right-3 z-[510] bg-ink/92 border border-line px-3 py-2.5 flex items-center gap-3 text-[12px] text-mute" style={{ top: "calc(env(safe-area-inset-top) + 104px)" }}>
          <span className="w-2 h-2 bg-lime animate-pulse shrink-0" />Procurando desafios nas vias públicas ao seu redor…
        </div>
      )}
      {perm === "granted" && pos && nearCount === 0 && busy !== "spawn" && !msg && spawnedAt.current && (
        <div className="absolute left-3 right-3 z-[510] bg-ink/92 border border-line p-3 flex items-center gap-3" style={{ top: "calc(env(safe-area-inset-top) + 104px)" }}>
          <EmblemIcon name="portal-blue" size={40} className="shrink-0" />
          <p className="flex-1 min-w-0 text-[12px] text-mute leading-snug">Ainda sem desafios aqui. Tentar novamente com as vias públicas da região?</p>
          <button onClick={() => pos && spawn(pos)} className="tap btn btn-lime btn-sm shrink-0">Tentar</button>
        </div>
      )}

      {/* progresso do Boss Especial */}
      <Link href="/map" onClick={(e) => { e.preventDefault(); setFilter("boss"); }} className="tap absolute left-3 z-[500] h-9 pl-1.5 pr-3 flex items-center gap-2 bg-ink/90 backdrop-blur border border-line text-[11px]" style={{ bottom: "68px" }}>
        <EmblemIcon name="portal-blue" size={26} dim={!special.active} className="shrink-0" />
        {special.active ? <span className="text-lime font-semibold">Boss Especial no mapa</span> : <span className="num"><span className="text-mute">Boss Especial </span>{special.count}/{special.need}</span>}
      </Link>

      {/* controles */}
      <div className="absolute right-3 bottom-4 z-[500] flex flex-col gap-2">
        {nearCount > 0 && <button onClick={generateHere} disabled={busy === "gen"} aria-label="Buscar novas missões" className={ctrl}><Icon name="target" size={19} className={busy === "gen" ? "animate-spin" : ""} /></button>}
        <button onClick={locate} aria-label="Centralizar na minha localização" className={`${ctrl} ${pos ? "!text-lime" : ""}`}><Icon name="locate" size={20} /></button>
      </div>
      <Link href="/record?sport=road_bike" className="tap absolute left-3 bottom-4 z-[500] btn btn-lime !h-11"><Icon name="record" size={16} />Iniciar atividade</Link>

      {/* camadas */}
      <BottomSheet open={sheet} onClose={() => setSheet(false)} title="Camadas do mapa">
        {([["relief", "Relevo e trilhas", "Curvas de nível (OpenTopoMap)", "mountain"], ["routes", "Minhas rotas", "Trajetos já gravados", "route"], ["territories", "Territórios", "Áreas conquistadas", "grid"], ["starts", "Pontos de partida", "Início das atividades", "pin"]] as const).map(([k, l, d, ic]) => (
          <label key={k} className="flex items-center gap-4 py-3.5 border-b border-line last:border-0 cursor-pointer">
            <Icon name={ic} size={22} className="text-mute shrink-0" />
            <span className="flex-1 min-w-0"><span className="block text-[15px]">{l}</span><span className="block text-[12px] text-mute">{d}</span></span>
            <input type="checkbox" className="sr-only peer" checked={layers[k]} onChange={(e) => setLayers({ ...layers, [k]: e.target.checked })} />
            <span className="w-11 h-7 shrink-0 bg-line peer-checked:bg-lime relative transition-colors after:absolute after:top-1 after:left-1 after:w-5 after:h-5 after:bg-ink after:transition-transform peer-checked:after:translate-x-4" />
          </label>
        ))}
      </BottomSheet>

      {/* missão selecionada */}
      <BottomSheet open={!!sel} onClose={() => setSelId(null)}>
        {sel && (() => {
          const d = distTo(sel);
          const hidden = sel.type === "secret" && sel.status !== "completed" && (d == null || d > SECRET_REVEAL_M);
          const can = CAPTURABLE.includes(sel.type) && sel.status !== "completed" && sel.status !== "paused" && inRange(sel);
          const path = sel.type === "route" || sel.type === "trail";
          const cps = sel.req.checkpoints ?? [];
          return (
            <div className="pt-1">
              <div className="flex items-start gap-4">
                <div className="emblem-float shrink-0"><EmblemIcon name={hidden ? "crystal-purple" : sel.emblem} size={sel.type === "boss" ? 92 : 76} filter={sel.type === "boss" && sel.category ? BOSS_STYLE[sel.category]?.filter : undefined} dim={hidden} /></div>
                <div className="min-w-0 flex-1">
                  <div className="eyebrow !text-[10px]">{TYPE_LABEL[sel.type]}{sel.category ? ` · ${({ easy: "Comum", climb: "Especial · Subida", endurance: "Especial · Resistência", exploration: "Exploração", legendary: "Especial · Lendário" } as Record<string, string>)[sel.category] ?? ""}` : ""}</div>
                  <div className="text-[18px] font-semibold leading-tight mt-1">{hidden ? "Missão secreta" : sel.title}</div>
                  <div className="flex items-center gap-3 mt-2 text-[12px]">
                    <span className={`px-1.5 py-0.5 ${sel.status === "completed" ? "bg-lime text-ink" : sel.status === "in_progress" ? "border border-lime text-lime" : "border border-line text-mute"}`}>{STATUS_LABEL[sel.status]}</span>
                    <span className="flex gap-0.5" aria-label={`Dificuldade ${sel.difficulty}/4`}>{[1, 2, 3, 4].map((i) => <span key={i} className={`w-1.5 h-3 ${i <= sel.difficulty ? "bg-bone" : "bg-line"}`} />)}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-px bg-line border border-line mt-4 text-center">
                <div className="bg-graphite py-2.5"><div className="num text-lg">{d == null ? "—" : d < 1000 ? `${Math.round(d)} m` : `${fmtKm(d, 1)} km`}</div><div className="text-[10px] text-mute">distância</div></div>
                <div className="bg-graphite py-2.5"><div className="num text-lg flex items-center justify-center gap-1"><Xp3D size={15} />{sel.xp}</div><div className="text-[10px] text-mute">XP</div></div>
                <div className="bg-graphite py-2.5"><div className="num text-lg flex items-center justify-center gap-1"><Coin3D size={15} />{sel.coins}</div><div className="text-[10px] text-mute">moedas</div></div>
              </div>

              <div className="mt-4 border-y border-line divide-y divide-line text-[13px]">
                <div className="flex justify-between gap-4 py-2.5"><span className="text-mute shrink-0">Objetivo</span><span className="text-right">{objective(sel)}</span></div>
                {sel.tier && <div className="flex justify-between gap-4 py-2.5"><span className="text-mute">Alcance</span><span>{TIER_LABEL[sel.tier]}</span></div>}
                {sel.expiresAt && sel.status !== "completed" && <div className="flex justify-between gap-4 py-2.5"><span className="text-mute">Tempo restante</span><span className={`num ${sel.template === "boss-special" ? "text-lime" : ""}`}>{left(sel.expiresAt, now)}</span></div>}
              </div>
              <p className="text-[13px] text-bone/80 leading-relaxed mt-4">{hidden ? `Chegue a menos de ${SECRET_REVEAL_M} m para revelar.` : sel.description}</p>
              {sel.item && !hidden && <div className="flex items-center gap-2 mt-3 text-[12px] text-mute"><EmblemIcon name={sel.item} size={26} />Item: <span className="text-bone">{emblemDef(sel.item).label}</span></div>}
              {!sel.verified && path && <div className="mt-3 text-[12px] border border-line p-2.5 text-mute"><span className="text-bone font-medium">Percurso precisa ser verificado.</span> A linha tracejada é uma referência entre pontos reais; confirme acesso e segurança antes de seguir.</div>}

              {sel.hpMax != null && (
                <div className="mt-4">
                  <div className="flex justify-between text-[11px] text-mute num"><span>HP</span><span>{sel.hp}/{sel.hpMax}</span></div>
                  <div className="h-2 bg-line mt-1"><div className="h-full bg-[#E5484D] transition-all duration-700" style={{ width: `${((sel.hp ?? 0) / sel.hpMax) * 100}%` }} /></div>
                  <ul className="mt-3 space-y-2">{(sel.req.challenges ?? []).map((c, i) => <li key={i} className="flex items-center gap-2.5 text-[13px]"><span className={`w-5 h-5 flex items-center justify-center shrink-0 ${c.done ? "bg-lime text-ink" : "border border-line"}`}>{c.done && <Icon name="check" size={12} />}</span><span className={`flex-1 ${c.done ? "text-mute line-through" : ""}`}>{c.label}</span><span className="num text-[11px] text-mute">−{c.damage}</span></li>)}</ul>
                </div>
              )}

              {path && (
                <ol className="mt-4 border-t border-line">
                  {cps.map((c, i) => { const ok = sel.progress.visited?.includes(i); const dd = here ? haversine(here, c) : null; return (
                    <li key={i} className="flex items-center gap-3 py-2.5 border-b border-line text-[13px]">
                      <span className={`w-6 h-6 flex items-center justify-center num text-[11px] shrink-0 ${ok ? "bg-lime text-ink" : "border border-line"}`}>{ok ? <Icon name="check" size={12} /> : i + 1}</span>
                      <span className="flex-1 min-w-0 truncate">{c.name ?? `Checkpoint ${i + 1}`}</span>
                      <span className="num text-[11px] text-mute">{dd == null ? "" : dd < 1000 ? `${Math.round(dd)} m` : `${fmtKm(dd, 1)} km`}</span>
                    </li>); })}
                  <li className="text-[11px] text-mute pt-2">Total aprox. {fmtKm(sel.req.distanceM ?? 0, 1)} km · validado pelo trajeto gravado, na ordem.</li>
                </ol>
              )}
              {(sel.type === "distance" || sel.type === "endurance") && sel.req.distanceM && (
                <div className="mt-4"><div className="h-[3px] bg-line"><div className="h-full bg-lime" style={{ width: `${Math.min(100, ((sel.progress.meters ?? 0) / sel.req.distanceM) * 100)}%` }} /></div><div className="text-[11px] text-mute mt-1.5 num">Melhor: {fmtKm(sel.progress.meters ?? 0, 1)} / {fmtKm(sel.req.distanceM, 1)} km</div></div>
              )}

              <div className="flex gap-2 mt-5">
                {can && !moving && sel.type === "photo" && (
                  <label className={`tap btn btn-lime flex-1 capture-cta cursor-pointer ${busy === "cap" ? "opacity-60 pointer-events-none" : ""}`}>
                    <Icon name="camera" size={16} />{busy === "cap" ? "Enviando…" : "Tirar foto do check-in"}
                    <input type="file" accept="image/*" capture="environment" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) doPhotoCheckin(sel, f); }} />
                  </label>
                )}
                {can && !moving && sel.type !== "photo" && <button onClick={() => doCapture(sel)} disabled={busy === "cap"} className="tap btn btn-lime flex-1 capture-cta">{sel.type === "boss" ? "Enfrentar boss" : "Capturar recompensa"}</button>}
                {can && moving && <div className="flex-1 h-12 flex items-center justify-center text-[13px] text-mute border border-line">Pare para interagir</div>}
                {!can && CAPTURABLE.includes(sel.type) && sel.status !== "completed" && sel.type !== "boss" && <div className="flex-1 h-12 flex items-center justify-center text-[12px] text-mute border border-line text-center px-2">Aproxime-se para capturar</div>}
                {(path || sel.type === "boss" || sel.type === "distance" || sel.type === "endurance") && sel.status !== "completed" && (
                  sel.status === "in_progress" ? <button onClick={() => setMissionState(sel, "pause")} className="tap btn btn-ghost flex-1">Pausar missão</button>
                  : sel.status === "paused" ? <button onClick={() => setMissionState(sel, "resume")} className="tap btn btn-lime flex-1">Retomar</button>
                  : <button onClick={() => setMissionState(sel, "start")} className="tap btn btn-lime flex-1">{sel.type === "boss" ? "Aceitar confronto" : "Iniciar missão"}</button>
                )}
              </div>
              {sel.status === "in_progress" && (path || sel.type === "boss" || sel.type === "distance" || sel.type === "endurance") && <Link href="/record?sport=road_bike" className="tap btn btn-ghost w-full mt-2"><Icon name="record" size={15} />Gravar atividade</Link>}
              {sel.lat != null && <a href={`https://www.openstreetmap.org/directions?to=${sel.lat}%2C${sel.lng}${here ? `&from=${here.lat}%2C${here.lng}` : ""}&engine=fossgis_osrm_bike`} target="_blank" rel="noreferrer" className="block text-center text-[12px] text-mute mt-3 link-u">Ver rota de bicicleta no OpenStreetMap</a>}
            </div>
          );
        })()}
      </BottomSheet>

      {/* atividade selecionada */}
      <BottomSheet open={!!selAct} onClose={() => setSelAct(null)}>
        {selAct && (
          <div className="pt-1">
            <div className="text-[16px] font-semibold truncate">{selAct.title}</div><div className="text-[12px] text-mute">{selAct.label} · {fmtDate(selAct.startedAt)}</div>
            <div className="grid grid-cols-3 gap-px bg-line border border-line mt-4">
              {[[fmtKm(selAct.distanceM), "km"], [fmtTime(selAct.movingSec), "tempo"], [selAct.group === "ciclismo" ? fmtSpeed(selAct.avgSpeed) : fmtPace(selAct.avgSpeed), selAct.group === "ciclismo" ? "km/h" : "/km"]].map(([v, l]) => <div key={l} className="bg-graphite p-3"><div className="num text-xl">{v}</div><div className="text-[11px] text-mute">{l}</div></div>)}
            </div>
            <Link href={`/activities/${selAct.id}`} className="btn btn-lime w-full mt-4">Ver atividade</Link>
          </div>
        )}
      </BottomSheet>

      {/* animação de captura */}
      {reward && (
        <div className="fixed inset-0 mx-auto max-w-[480px] z-[1000] bg-ink/95 flex flex-col items-center justify-center px-6 text-center" onClick={() => setReward(null)}>
          <div className="reward-burst" />
          <div className="reward-pop"><EmblemIcon name={reward.emblem} size={180} /></div>
          <div className="eyebrow mt-6 rise">{reward.boss && (reward.hp ?? 0) > 0 ? "Golpe no boss" : "Recompensa capturada"}</div>
          <h2 className="display text-[34px] mt-2 rise" style={{ animationDelay: "120ms" }}>{reward.title}</h2>
          <div className="flex items-center gap-5 mt-5 rise num text-xl" style={{ animationDelay: "240ms" }}>
            <span className="flex items-center gap-1.5"><Xp3D size={24} />+{reward.xp}</span>
            {reward.coins > 0 && <span className="flex items-center gap-1.5"><Coin3D size={24} />+{reward.coins}</span>}
          </div>
          {reward.item && <div className="flex items-center gap-2 mt-4 text-[13px] text-mute rise" style={{ animationDelay: "320ms" }}><EmblemIcon name={reward.item} size={34} />{emblemDef(reward.item).label} adicionado ao inventário</div>}
          <button className="tap btn btn-lime mt-8 w-full max-w-[280px]">Continuar</button>
        </div>
      )}
    </div>
  );
}
