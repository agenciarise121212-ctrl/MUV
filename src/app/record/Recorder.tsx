"use client";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Icon from "@/components/Icon";
import { SPORTS, GROUPS, getSport, type Sport } from "@/lib/sports";
import { haversine, calories, fmtTime, fmtKm, fmtSpeed, fmtPace } from "@/lib/format";
import type { TrackPoint } from "@/db/schema";
import { liveCheck } from "@/lib/anticheat";
import { fetchJson } from "@/lib/http";
import { compressImage, MAX_PHOTOS } from "@/lib/image";

const RouteMap = dynamic(() => import("@/components/RouteMap"), { ssr: false, loading: () => <div className="h-full bg-graphite" /> });

type Phase = "select" | "ready" | "recording" | "paused" | "saving";
type Session = {
  sport: string; startedAt: number; elapsedMs: number; movingMs: number; distanceM: number; elevGainM: number;
  maxSpeed: number; maxAlt: number | null; minAlt: number | null; points: TrackPoint[]; altBase: number | null; phase: Phase;
};
const KEY = "pulso-recording";
const PKEY = "muv-pending-photos";
type PendingPhoto = { data: string; lat: number | null; lng: number | null; km: number; t: number };
const userWeight = () => { if (typeof window === "undefined") return 70; const w = Number(localStorage.getItem("muv-weight")); return w >= 30 && w <= 250 ? w : 70; };
const blank = (sport: string): Session => ({ sport, startedAt: 0, elapsedMs: 0, movingMs: 0, distanceM: 0, elevGainM: 0, maxSpeed: 0, maxAlt: null, minAlt: null, points: [], altBase: null, phase: "ready" });

export default function Recorder({ initialSport }: { initialSport?: string }) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("select");
  const [sport, setSport] = useState<Sport>(SPORTS[0]);
  const [, force] = useState(0);
  const s = useRef<Session>(blank(SPORTS[0].key));
  const [fix, setFix] = useState<GeolocationPosition | null>(null);
  const [gpsErr, setGpsErr] = useState<string | null>(null);
  const [speed, setSpeed] = useState(0);
  const [autoPaused, setAutoPaused] = useState(false);
  const [autoPauseOn, setAutoPauseOn] = useState(true);
  const [follow, setFollow] = useState(true);
  const [indoorKm, setIndoorKm] = useState("");
  const [showPoints, setShowPoints] = useState(false);
  const [pending, setPending] = useState<PendingPhoto[]>([]);
  const [snapping, setSnapping] = useState(false);
  const [pocket, setPocket] = useState(false);
  const [recovered, setRecovered] = useState(false);
  const camRef = useRef<HTMLInputElement>(null);
  const watchId = useRef<number | null>(null);
  const lastTick = useRef<number>(0);
  const lastFixAt = useRef<number>(0);
  const slowSince = useRef<number | null>(null);
  const phaseRef = useRef<Phase>("select");
  const autoRef = useRef(false);
  const autoOnRef = useRef(true);
  const wake = useRef<WakeLockSentinel | null>(null);
  phaseRef.current = phase; autoRef.current = autoPaused; autoOnRef.current = autoPauseOn;

  // Recupera sessão interrompida automaticamente (reload, bloqueio de tela, navegador fechado)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const saved = JSON.parse(raw) as Session & { savedAt?: number };
        if (saved.startedAt) {
          const wasRecording = saved.phase === "recording";
          // tempo fora do app conta no tempo total, mas não como tempo em movimento
          const gap = wasRecording && saved.savedAt ? Math.max(0, Date.now() - saved.savedAt) : 0;
          s.current = { ...saved, elapsedMs: saved.elapsedMs + gap, phase: wasRecording ? "recording" : "paused" };
          const sp = getSport(saved.sport);
          setSport(sp);
          lastTick.current = Date.now();
          setPhase(wasRecording ? "recording" : "paused");
          startGps(sp);
          setRecovered(true); setTimeout(() => setRecovered(false), 4000);
        } else localStorage.removeItem(KEY);
      }
      const pend = localStorage.getItem(PKEY);
      if (pend) setPending(JSON.parse(pend));
      const init = initialSport ? SPORTS.find((x) => x.key === initialSport && x.enabled) : undefined;
      if (init && !s.current.startedAt) choose(init);
    } catch { localStorage.removeItem(KEY); }
    const onHide = () => { if (document.visibilityState === "hidden") persist(); };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", persist);
    return () => { document.removeEventListener("visibilitychange", onHide); window.removeEventListener("pagehide", persist); if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current); wake.current?.release().catch(() => {}); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Screen Wake Lock: mantém a tela (e o GPS) acordados durante a gravação; reativa ao voltar para a aba
  useEffect(() => {
    const active = phase === "recording" || phase === "paused";
    const req = async () => { try { if (active && document.visibilityState === "visible" && "wakeLock" in navigator && (!wake.current || wake.current.released)) wake.current = await navigator.wakeLock.request("screen"); } catch {} };
    if (active) req(); else { wake.current?.release().catch(() => {}); wake.current = null; }
    const onVis = () => { if (document.visibilityState === "visible") { req(); if (watchId.current == null && active) startGps(getSport(s.current.sport)); } };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // Diário de rota: foto com coordenada, km e horário (fica no aparelho até salvar a atividade)
  async function addRoutePhoto(file: File | undefined) {
    if (!file) return;
    if (pending.length >= MAX_PHOTOS) { alert(`Limite de ${MAX_PHOTOS} fotos por atividade.`); return; }
    setSnapping(true);
    try {
      const data = await compressImage(file);
      const last = s.current.points[s.current.points.length - 1];
      const lat = fix?.coords.latitude ?? last?.lat ?? null, lng = fix?.coords.longitude ?? last?.lng ?? null;
      const next = [...pending, { data, lat, lng, km: +(s.current.distanceM / 1000).toFixed(2), t: Date.now() }];
      setPending(next);
      try { localStorage.setItem(PKEY, JSON.stringify(next)); } catch { alert("Pouco espaço no aparelho para guardar a foto até o fim do treino."); }
      navigator.vibrate?.(40);
    } catch (e) { alert(e instanceof Error ? e.message : "Falha ao processar a foto."); }
    setSnapping(false);
  }

  function persist() { try { localStorage.setItem(KEY, JSON.stringify({ ...s.current, phase: phaseRef.current, savedAt: Date.now() })); } catch {} }

  function startGps(sp: Sport) {
    if (!sp.gps) return;
    if (!("geolocation" in navigator)) { setGpsErr("GPS não disponível neste dispositivo/navegador."); return; }
    if (watchId.current != null) return;
    watchId.current = navigator.geolocation.watchPosition(onPos, (e) => setGpsErr(e.code === 1 ? "Permissão de localização negada. Ative o GPS nas configurações do navegador." : e.message), { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 });
  }

  function onPos(pos: GeolocationPosition) {
    setGpsErr(null);
    setFix(pos);
    const now = pos.timestamp || Date.now();
    lastFixAt.current = Date.now();
    if (phaseRef.current !== "recording") return;
    const c = pos.coords;
    const sp = getSport(s.current.sport);
    const pts = s.current.points;
    const last = pts[pts.length - 1];
    const pt: TrackPoint = { lat: c.latitude, lng: c.longitude, alt: c.altitude, t: now, acc: Math.round(c.accuracy), spd: c.speed };
    if (c.accuracy > 40) return; // descarta leituras imprecisas
    let v = c.speed ?? 0;
    if (last) {
      const d = haversine(last, pt);
      const dt = (now - last.t) / 1000;
      if (dt <= 0) return;
      const calc = d / dt;
      if (c.speed == null) v = calc;
      if (calc > 85) return; // teleporte (salto impossível de GPS) — demais velocidades ficam registradas para validação
      if (d < Math.max(2, c.accuracy * 0.25)) { setSpeed(v); handleAutoPause(v, sp); return; }
      if (!autoRef.current) s.current.distanceM += d;
    }
    setSpeed(v);
    handleAutoPause(v, sp);
    if (v > s.current.maxSpeed && v < 85) s.current.maxSpeed = v;
    if (c.altitude != null) {
      const a = c.altitude;
      s.current.maxAlt = Math.max(s.current.maxAlt ?? a, a);
      s.current.minAlt = Math.min(s.current.minAlt ?? a, a);
      if (s.current.altBase == null) s.current.altBase = a;
      else if (a - s.current.altBase > 3) { s.current.elevGainM += a - s.current.altBase; s.current.altBase = a; }
      else if (s.current.altBase - a > 3) s.current.altBase = a;
    }
    pts.push(pt);
    persist();
    force((n) => n + 1);
  }

  function handleAutoPause(v: number, sp: Sport) {
    if (!sp.autoPauseSpeed || !autoOnRef.current) { if (autoRef.current) setAutoPaused(false); return; }
    if (v < sp.autoPauseSpeed) {
      slowSince.current ??= Date.now();
      if (Date.now() - slowSince.current > 6000 && !autoRef.current) setAutoPaused(true);
    } else { slowSince.current = null; if (autoRef.current) setAutoPaused(false); }
  }

  // Cronômetro
  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now();
      const dt = now - lastTick.current;
      lastTick.current = now;
      if (phaseRef.current !== "recording") return;
      s.current.elapsedMs += dt;
      const sp = getSport(s.current.sport);
      // sem sinal de GPS por muito tempo => considera parado
      if (sp.gps && now - lastFixAt.current > 12000) handleAutoPause(0, sp);
      if (!autoRef.current) s.current.movingMs += dt;
      if (s.current.elapsedMs % 5000 < 1000) persist();
      force((n) => n + 1);
    }, 1000);
    lastTick.current = Date.now();
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function choose(sp: Sport) {
    setSport(sp);
    s.current = blank(sp.key);
    setPhase("ready");
    startGps(sp);
  }

  async function start() {
    s.current.startedAt = Date.now();
    lastTick.current = Date.now();
    setPhase("recording"); phaseRef.current = "recording"; persist();
  }
  function pause() { setPhase("paused"); phaseRef.current = "paused"; persist(); }
  function resume() { lastTick.current = Date.now(); setPhase("recording"); phaseRef.current = "recording"; persist(); }
  function discard() {
    if (!confirm("Descartar esta atividade? Os dados gravados serão perdidos.")) return;
    localStorage.removeItem(KEY); localStorage.removeItem(PKEY); setPending([]);
    s.current = blank(sport.key);
    setPhase("select");
  }

  async function finish() {
    const cur = s.current;
    if (cur.elapsedMs < 5000) { alert("Atividade muito curta para salvar."); return; }
    setPhase("saving");
    const movingSec = (sport.gps ? cur.movingMs : cur.elapsedMs) / 1000;
    const distanceM = sport.gps ? cur.distanceM : (parseFloat(indoorKm.replace(",", ".")) || 0) * 1000;
    const body = {
      sport: sport.key, startedAt: new Date(cur.startedAt).toISOString(), elapsedSec: cur.elapsedMs / 1000, movingSec,
      distanceM, elevGainM: cur.elevGainM, maxAltM: cur.maxAlt, minAltM: cur.minAlt,
      avgSpeed: movingSec > 0 ? distanceM / movingSec : 0, maxSpeed: cur.maxSpeed, calories: calories(sport.met, movingSec, userWeight()), points: cur.points,
    };
    try {
      const r = await fetchJson<{ id: number; integrity: string }>("/api/activities", { json: body });
      if (!r.ok) { alert(`${r.error} Seus dados continuam guardados neste aparelho.`); setPhase("paused"); return; }
      const { id } = r.data;
      for (const p of pending) await fetchJson(`/api/activities/${id}/photos`, { json: { data: p.data, lat: p.lat, lng: p.lng, kmMark: p.km, takenAt: p.t } });
      localStorage.removeItem(PKEY);
      localStorage.removeItem(KEY);
      if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current);
      wake.current?.release().catch(() => {});
      router.push(`/activities/${id}/edit?new=1`);
    } catch {
      alert("Falha ao salvar. Seus dados continuam guardados — tente novamente.");
      setPhase("paused");
    }
  }

  // ---------- Seleção de modalidade ----------
  if (phase === "select") {
    return (
      <div className="min-h-[100dvh] bg-ink pb-nav">
        <div className="px-4">
          <div className="sticky top-0 z-[500] -mx-4 px-4 bg-ink/94 backdrop-blur-md border-b border-line flex items-center justify-between" style={{ paddingTop: "env(safe-area-inset-top)", height: "calc(3rem + env(safe-area-inset-top))" }}>
            <Link href="/" aria-label="Fechar" className="w-10 h-10 -ml-2 flex items-center justify-center text-mute hover:text-bone transition-colors"><Icon name="close" /></Link>
            <span className="text-[15px] font-semibold">Atividade</span>
            <span className="w-10" />
          </div>
          <h1 className="display text-[40px] pt-5 pb-5">Escolha<br />sua modalidade.</h1>
          {GROUPS.map((g, gi) => (
            <section key={g.key} className="py-4">
              <h2 className="eyebrow mb-2 flex items-center gap-2"><span className="num">0{gi + 1}</span>{g.label}</h2>
              <div className=" grid grid-cols-1   gap-px bg-line border border-line">
                {SPORTS.filter((x) => x.group === g.key).map((x) => (
                  <button key={x.key} disabled={!x.enabled} onClick={() => choose(x)}
                    className="tap group text-left bg-ink px-4 min-h-[60px] flex items-center gap-4 transition-colors enabled:hover:bg-graphite disabled:cursor-not-allowed">
                    <Icon name={x.key} size={26} className={x.enabled ? "text-bone group-hover:text-lime transition-colors" : "text-mute/40"} />
                    <span className="flex-1">
                      <span className={`block text-[15px] ${x.enabled ? "" : "text-mute/60"}`}>{x.label}</span>
                      <span className="block text-[11px] text-mute mt-0.5">{!x.enabled ? "Em breve" : x.gps ? (x.display === "speed" ? "GPS · velocidade" : "GPS · pace") : "Sem GPS"}</span>
                    </span>
                    {x.enabled && <Icon name="arrow" size={16} className="text-lime opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />}
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    );
  }

  // ---------- Gravação ----------
  const cur = s.current;
  const movingSec = (sport.gps ? cur.movingMs : cur.elapsedMs) / 1000;
  const avg = movingSec > 0 ? cur.distanceM / movingSec : 0;
  const acc = fix?.coords.accuracy;
  const alt = fix?.coords.altitude;
  const gpsLevel = !sport.gps ? "off" : !fix ? "none" : acc! <= 10 ? "great" : acc! <= 25 ? "good" : "weak";
  const gpsBars = { off: 0, none: 0, weak: 1, good: 2, great: 3 }[gpsLevel];
  const gpsText = { off: "Indoor", none: "Buscando GPS", great: "GPS forte", good: "GPS bom", weak: "GPS fraco" }[gpsLevel];
  const isBike = sport.group === "ciclismo";
  const cur2 = fix ? { lat: fix.coords.latitude, lng: fix.coords.longitude } : null;
  const canStart = !sport.gps || (fix && acc! <= 50);
  const live = phase === "recording";
  const cheat = sport.gps && cur.points.length > 5 ? liveCheck(cur.points, sport.group) : null;

  const Stat = ({ label, value, unit, big }: { label: string; value: string; unit?: string; big?: boolean }) => (
    <div className={big ? "py-5  px-5" : "py-4 px-5"}>
      <div className="eyebrow !text-[10px]">{label}</div>
      <div className={`num leading-none mt-2 ${big ? "text-[88px]  " : "text-[34px] "}`}>{value}{unit && <span className="text-sm text-mute font-sans font-medium ml-2 tracking-normal">{unit}</span>}</div>
    </div>
  );

  return (
    <div className="fixed inset-0 mx-auto max-w-[480px] z-[700] bg-ink text-bone flex flex-col ">
      {/* topo */}
      <div className="absolute  top-0 inset-x-0 z-[700] h-14 flex items-center justify-between px-4 bg-ink/85 backdrop-blur border-b border-line">
        <button onClick={() => (phase === "ready" ? setPhase("select") : discard())} className="text-[13px] text-mute hover:text-bone transition-colors">{phase === "ready" ? "Trocar" : "Descartar"}</button>
        <div className="flex items-center gap-2 text-[13px] font-medium"><Icon name={sport.key} size={18} />{sport.label}</div>
        <div className="flex items-center gap-2 text-[11px] text-mute">
          <span className="flex items-end gap-[2px] h-3">{[1, 2, 3].map((b) => <span key={b} className={`w-[3px] ${b <= gpsBars ? "bg-lime" : "bg-line"} ${gpsLevel === "none" ? "animate-pulse" : ""}`} style={{ height: `${b * 4}px` }} />)}</span>
          <span className="hidden ">{gpsText}</span>
        </div>
      </div>

      {sport.gps && (
        <div className="relative h-[36vh]   shrink-0 pt-14 ">
          <RouteMap points={cur.points} current={cur2} accuracy={acc} follow={follow} className="h-full" />
          <div className="absolute top-[68px] left-3 z-[500] bg-ink/85 border border-line px-3 py-2 text-[11px] text-mute space-y-0.5">
            <div>Precisão <span className="num text-bone ml-1">{acc != null ? `±${Math.round(acc)} m` : "—"}</span></div>
            <div>Pontos <span className="num text-bone ml-1">{cur.points.length}</span></div>
          </div>
          <button onClick={() => setFollow(!follow)} aria-label="Seguir posição" className={`absolute top-[68px] right-3 z-[500] w-10 h-10 flex items-center justify-center border transition-colors ${follow ? "bg-lime text-ink border-lime" : "bg-ink/85 text-bone border-line"}`}><Icon name="pin" size={18} /></button>
          {gpsErr && <div className="absolute bottom-0 inset-x-0 z-[500] bg-bone text-ink text-sm p-3 text-center">{gpsErr}</div>}
        </div>
      )}

      <div className={`flex-1  ${sport.gps ? "  " : " max-w-3xl mx-auto"} overflow-y-auto relative z-10 ${sport.gps ? "" : "pt-14"}  flex flex-col`}>
        {(phase === "paused" || autoPaused) && phase !== "ready" && (
          <div className={`text-center text-[11px] font-semibold uppercase tracking-[.2em] py-2 ${phase === "paused" ? "bg-bone text-ink" : "bg-lime text-ink"}`}>
            {phase === "paused" ? "Pausado" : "Pausa automática"}
          </div>
        )}
        {cheat?.over && (
          <div role="alert" className="px-5 py-3 bg-[#2A1A12] border-b border-[#5C3A1E] text-[12px] leading-snug text-[#F5D0B5]">
            <span className="font-semibold text-bone">Velocidade incompatível com {sport.label.toLowerCase()}</span> — {cheat.kmh} km/h sustentados (limite {cheat.limit} km/h). Se continuar, esta atividade não contará para recompensas e rankings.
          </div>
        )}
        <div className="divide-y divide-line border-b border-line">
          {isBike ? (
            <>
              <Stat big label="Velocidade" unit="km/h" value={fmtSpeed(live ? speed : 0)} />
              <div className="grid grid-cols-2 divide-x divide-line">
                <Stat label="Distância" unit="km" value={fmtKm(cur.distanceM)} />
                <Stat label="Em movimento" value={fmtTime(movingSec)} />
              </div>
              <div className="grid grid-cols-3 divide-x divide-line">
                <Stat label="Média" value={fmtSpeed(avg)} />
                <Stat label="Máxima" value={fmtSpeed(cur.maxSpeed)} />
                <Stat label="Total" value={fmtTime(cur.elapsedMs / 1000)} />
              </div>
            </>
          ) : (
            <>
              <Stat big label="Tempo" value={fmtTime(sport.gps ? movingSec : cur.elapsedMs / 1000)} />
              <div className="grid grid-cols-2 divide-x divide-line">
                <Stat label="Distância" unit="km" value={fmtKm(cur.distanceM)} />
                <Stat label="Pace atual" unit="/km" value={fmtPace(live ? speed : 0)} />
              </div>
              <div className="grid grid-cols-3 divide-x divide-line">
                <Stat label="Pace médio" value={fmtPace(avg)} />
                <Stat label="km/h" value={fmtSpeed(live ? speed : 0)} />
                <Stat label="Total" value={fmtTime(cur.elapsedMs / 1000)} />
              </div>
            </>
          )}
          <div className="grid grid-cols-3 divide-x divide-line">
            <Stat label="Altitude" unit="m" value={alt != null ? String(Math.round(alt)) : "—"} />
            <Stat label="Elevação" unit="m" value={String(Math.round(cur.elevGainM))} />
            <Stat label="Calorias" value={String(calories(sport.met, movingSec, userWeight()))} />
          </div>
        </div>

        <div className="px-5 py-4 space-y-4">
          {!sport.gps && phase !== "ready" && (
            <label className="block text-xs text-mute">Distância do aparelho (km)
              <input inputMode="decimal" value={indoorKm} onChange={(e) => setIndoorKm(e.target.value)} className="field mt-2 num text-lg" placeholder="5,2" />
            </label>
          )}
          {sport.autoPauseSpeed && (
            <label className="flex items-center justify-between text-sm text-mute cursor-pointer">
              Pausa automática
              <input type="checkbox" checked={autoPauseOn} onChange={(e) => setAutoPauseOn(e.target.checked)} className="sr-only peer" />
              <span className="w-10 h-6 bg-line peer-checked:bg-lime relative transition-colors after:absolute after:top-1 after:left-1 after:w-4 after:h-4 after:bg-ink after:transition-transform peer-checked:after:translate-x-4" />
            </label>
          )}
          {sport.gps && cur.points.length > 0 && (
            <div>
              <button onClick={() => setShowPoints(!showPoints)} className="text-[13px] text-bone link-u">{showPoints ? "Ocultar" : "Ver"} histórico de pontos · {cur.points.length}</button>
              {showPoints && (
                <div className="mt-3 max-h-40 overflow-y-auto text-[11px] font-mono text-mute bg-graphite border border-line p-3 space-y-0.5">
                  {cur.points.slice(-50).reverse().map((p, i) => (
                    <div key={i}>{new Date(p.t).toLocaleTimeString("pt-BR")} · {p.lat.toFixed(5)}, {p.lng.toFixed(5)} · alt {p.alt != null ? Math.round(p.alt) : "-"} · ±{p.acc}m</div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="h-32  shrink-0" />

        <div className={`fixed bottom-0 inset-x-0 mx-auto max-w-[480px] z-20 bg-ink border-t border-line px-5 pt-5 flex justify-center items-center gap-5`} style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}>
          {(phase === "recording" || phase === "paused") && (
            <div className="absolute left-4 top-1/2 -translate-y-1/2 flex flex-col items-center gap-1" style={{ marginTop: "calc(env(safe-area-inset-bottom) / -2)" }}>
              <button onClick={() => camRef.current?.click()} disabled={snapping || pending.length >= MAX_PHOTOS} aria-label="Foto do percurso" className="tap w-12 h-12 rounded-full border border-line flex items-center justify-center text-bone disabled:opacity-40">
                <Icon name="camera" size={20} className={snapping ? "animate-pulse" : ""} />
              </button>
              <span className="num text-[10px] text-mute">{pending.length}/{MAX_PHOTOS}</span>
              <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { addRoutePhoto(e.target.files?.[0]); e.target.value = ""; }} />
            </div>
          )}
          {(phase === "recording" || phase === "paused") && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col items-center gap-1" style={{ marginTop: "calc(env(safe-area-inset-bottom) / -2)" }}>
              <button onClick={() => setPocket(true)} aria-label="Modo Bolso" className="tap w-12 h-12 rounded-full border border-line flex items-center justify-center text-bone"><Icon name="lock" size={19} /></button>
              <span className="text-[10px] text-mute">Bolso</span>
            </div>
          )}
          {phase === "ready" && (
            <button disabled={!canStart} onClick={start} className="w-[92px] h-[92px] rounded-full bg-lime text-ink font-semibold text-[13px] tracking-[.12em] uppercase transition-transform active:scale-95 disabled:bg-line disabled:text-mute">
              {canStart ? "Iniciar" : <span className="text-[10px] leading-tight block px-2">Aguardando GPS</span>}
            </button>
          )}
          {phase === "recording" && (
            <button onClick={pause} aria-label="Pausar" className="w-[92px] h-[92px] rounded-full bg-bone text-ink flex flex-col items-center justify-center gap-1.5 active:scale-95 transition-transform">
              <span className="flex gap-1.5"><span className="w-1.5 h-5 bg-ink" /><span className="w-1.5 h-5 bg-ink" /></span><span className="text-[10px] font-semibold tracking-[.15em] uppercase">Pausar</span>
            </button>
          )}
          {phase === "paused" && (
            <>
              <button onClick={resume} aria-label="Continuar" className="w-[92px] h-[92px] rounded-full bg-lime text-ink flex flex-col items-center justify-center gap-1.5 active:scale-95 transition-transform">
                <span className="w-0 h-0 border-y-[10px] border-y-transparent border-l-[16px] border-l-ink ml-1" /><span className="text-[10px] font-semibold tracking-[.15em] uppercase">Continuar</span>
              </button>
              <button onClick={finish} aria-label="Finalizar" className="w-[92px] h-[92px] rounded-full border border-bone text-bone flex flex-col items-center justify-center gap-1.5 active:scale-95 transition-transform hover:bg-bone hover:text-ink">
                <span className="w-4 h-4 bg-current" /><span className="text-[10px] font-semibold tracking-[.15em] uppercase">Finalizar</span>
              </button>
            </>
          )}
          {phase === "saving" && <div className="h-[92px] flex items-center text-sm text-mute"><span className="w-2 h-2 bg-lime mr-3 animate-pulse" />Salvando atividade</div>}
        </div>
      </div>
      {recovered && <div className="fixed top-16 inset-x-0 mx-auto max-w-[440px] z-[750] px-4"><div className="bg-bone text-ink text-[13px] font-medium px-3 py-2.5 rise">Treino recuperado — GPS reconectado, continuando de onde parou.</div></div>}
      {pocket && <PocketMode time={fmtTime((sport.gps ? s.current.movingMs : s.current.elapsedMs) / 1000)} km={fmtKm(s.current.distanceM)} paused={phase === "paused"} onUnlock={() => setPocket(false)} />}
    </div>
  );
}

// Modo Bolso: tela preta absoluta (economia em OLED) + trava contra toques acidentais
function PocketMode({ time, km, paused, onUnlock }: { time: string; km: string; paused: boolean; onUnlock: () => void }) {
  const track = useRef<HTMLDivElement>(null);
  const [x, setX] = useState(0);
  const drag = useRef<number | null>(null);
  const max = () => (track.current?.clientWidth ?? 280) - 56;
  return (
    <div className="fixed inset-0 z-[2000] bg-black select-none touch-none flex flex-col items-center justify-center" onContextMenu={(e) => e.preventDefault()} role="dialog" aria-label="Modo Bolso ativo">
      <div className="opacity-35 text-center text-bone">
        <div className="num text-6xl">{time}</div>
        <div className="num text-2xl mt-2">{km} <span className="text-sm font-sans">km</span></div>
        <div className="text-[11px] uppercase tracking-[.2em] mt-3">{paused ? "Pausado" : "Gravando"}</div>
      </div>
      <div ref={track} className="absolute left-8 right-8 h-14 rounded-full border border-white/15 overflow-hidden" style={{ bottom: "calc(48px + env(safe-area-inset-bottom))" }}>
        <span className="absolute inset-0 flex items-center justify-center text-[12px] tracking-wider text-white/30 pointer-events-none">Deslize para desbloquear</span>
        <div className="absolute top-1 left-1 w-12 h-12 rounded-full bg-white/20 flex items-center justify-center text-white/60"
          style={{ transform: `translateX(${x}px)`, transition: drag.current == null ? "transform .3s" : "none" }}
          onPointerDown={(e) => { drag.current = e.clientX - x; (e.target as HTMLElement).setPointerCapture(e.pointerId); }}
          onPointerMove={(e) => { if (drag.current != null) setX(Math.max(0, Math.min(max(), e.clientX - drag.current))); }}
          onPointerUp={() => { const done = x > max() * 0.85; drag.current = null; if (done) { navigator.vibrate?.(30); onUnlock(); } else setX(0); }}>
          <Icon name="arrow" size={18} />
        </div>
      </div>
    </div>
  );
}
