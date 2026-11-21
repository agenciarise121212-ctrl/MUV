"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { TrackPoint } from "@/db/schema";
import { formatDuration, formatPace, formatSpeed, formatDistance } from "@/lib/format";
import { estimateCalories, haversine } from "@/lib/geo";
import { getSport } from "@/lib/sports";
import { limitFor, familyOf, FAMILY_LABEL } from "@/lib/anticheat";
import MapView from "@/components/MapView";
import { Icon, SportIcon } from "@/components/icons.client";
import {
  PocketMode,
  useWakeLock,
  activeSessionKey,
  clearActiveSession,
  saveRecordingState,
  loadRecordingState,
  dropRecordingState,
} from "@/components/PocketMode";
import { useRoutePhotos } from "@/lib/route-photos";
import { MAX_PHOTOS_PER_ACTIVITY, formatBytes } from "@/lib/image";

type Phase = "ready" | "recording" | "paused" | "saving" | "error";

type Snapshot = {
  distanceM: number;
  movingSec: number;
  elapsedSec: number;
  gain: number;
  loss: number;
  maxSpeed: number;
  currentSpeed: number;
  calories: number;
  points: number;
  accuracy: number;
  altitude: number | null;
};

/* --------------------- Parâmetros da pausa automática --------------------- */

/** Janela mínima de imobilidade antes de pausar. */
const AUTO_PAUSE_WINDOW_SEC = 20;
/** Deslocamento máximo acumulado na janela para considerar parado. */
const AUTO_PAUSE_MIN_MOVE_M = 8;
/** Deslocamento por amostra que já conta como movimento (interrompe a janela). */
const AUTO_PAUSE_MAX_STEP_M = 3;
/** Janela mínima de movimento antes de retomar. */
const AUTO_PAUSE_RESUME_SEC = 2;
/** Deslocamento acumulado mínimo para confirmar a retomada. */
const AUTO_PAUSE_RESUME_MOVE_M = 6;
/** Deslocamento por amostra que confirma movimento na retomada. */
const AUTO_PAUSE_RESUME_STEP_M = 4;

const EMPTY: Snapshot = {
  distanceM: 0,
  movingSec: 0,
  elapsedSec: 0,
  gain: 0,
  loss: 0,
  maxSpeed: 0,
  currentSpeed: 0,
  calories: 0,
  points: 0,
  accuracy: 0,
  altitude: null,
};

export function RecordClient({
  sportKey,
  weightKg,
  deviceName,
}: {
  sportKey: string;
  weightKg: number;
  deviceName: string;
}) {
  const sport = getSport(sportKey);
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("ready");
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [hasSignal, setHasSignal] = useState(false);
  const [stats, setStats] = useState<Snapshot>(EMPTY);
  const [userPos, setUserPos] = useState<[number, number] | null>(null);
  const [accuracy, setAccuracy] = useState(0);
  const [route, setRoute] = useState<[number, number][]>([]);
  const [follow, setFollow] = useState(true);
  const [autoPaused, setAutoPaused] = useState(false);
  const [manualDistance, setManualDistance] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  const pointsRef = useRef<TrackPoint[]>([]);
  const distanceRef = useRef(0);
  const movingRef = useRef(0);
  const elapsedRef = useRef(0);
  const gainRef = useRef(0);
  const lossRef = useRef(0);
  const maxSpeedRef = useRef(0);
  const elevBaseRef = useRef<number | null>(null);
  const pausesRef = useRef(0);
  const autoPausesRef = useRef(0);
  /**
   * Detecção de parada por DESLOCAMENTO REAL, não por `coords.speed`.
   *
   * Navegadores mobile — especialmente o Safari no iOS — retornam `null` ou
   * `0` em `coords.speed` durante caminhadas e corridas. O bug anterior usava
   * `deviceSpeed ?? stepSpeed`, e como `??` só cai para o lado direito quando o
   * valor é `null`/`undefined`, um `coords.speed === 0` fazia a velocidade
   * ficar travada em 0: o app "pausava automaticamente" o tempo todo com o
   * usuário em movimento contínuo.
   *
   * Agora somamos o deslocamento real entre pontos válidos de GPS. A pausa só
   * dispara após 20 s consecutivos com menos de 8 m de deslocamento acumulado.
   */
  const stillWindowRef = useRef<{ start: number; moved: number } | null>(null);
  const resumeWindowRef = useRef<{ start: number; moved: number } | null>(null);
  const watchRef = useRef<number | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const pausedAtRef = useRef<number | null>(null);
  const phaseRef = useRef<Phase>("ready");
  // Recuperação: chave estável do treino ativo (sobrevive a recarregamento).
  // `useState` com inicializador que toca `window` quebra a renderização no
  // servidor — por isso a chave é resolvida depois da montagem.
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [resumed, setResumed] = useState(false);
  const [pocket, setPocket] = useState(false);
  /**
   * Pausa automática: DESLIGADA por padrão.
   *
   * Antes este valor vinha do perfil do usuário (`autoPauseEnabled`), que
   * nascia `true` no banco — por isso o app pausava sozinho sem ninguém pedir.
   * Agora o padrão é sempre desligado e o usuário liga explicitamente a cada
   * modalidade, com a escolha lembrada no dispositivo.
   */
  const [autoPauseOn, setAutoPauseOn] = useState(false);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    setSessionId(activeSessionKey());
    try {
      setAutoPauseOn(window.localStorage.getItem("muv-auto-pause") === "1");
    } catch {
      setAutoPauseOn(false);
    }
  }, []);

  function toggleAutoPause(next: boolean) {
    setAutoPauseOn(next);
    try {
      window.localStorage.setItem("muv-auto-pause", next ? "1" : "0");
    } catch {
      /* sem storage: mantém apenas em memória */
    }
    // Se desligar durante uma pausa automática, retoma imediatamente.
    if (!next && autoPaused) resume();
  }

  // RECUPERAÇÃO AUTOMÁTICA: se o navegador recarregou no meio do percurso,
  // retomamos os pontos, a distância e o tempo de onde pararam.
  useEffect(() => {
    const saved = loadRecordingState();
    if (!saved || saved.sportKey !== sportKey) return;
    pointsRef.current = saved.points as TrackPoint[];
    distanceRef.current = saved.distanceM;
    movingRef.current = saved.movingSec;
    gainRef.current = saved.gainM;
    lossRef.current = saved.lossM;
    maxSpeedRef.current = saved.maxSpeedKmh;
    pausesRef.current = saved.pauses;
    autoPausesRef.current = saved.autoPauses;
    startedAtRef.current = saved.startedAt;
    elapsedRef.current = (Date.now() - saved.startedAt) / 1000;
    phaseRef.current = "recording";
    setPhase("recording");
    setResumed(true);
    window.setTimeout(() => setResumed(false), 6000);
  }, [sportKey]);

  const gpsQuality = useMemo(() => {
    if (!hasSignal || accuracy === 0) return { label: "Aguardando GPS", tone: "#8a97a8" };
    if (accuracy <= 8) return { label: "GPS ótimo", tone: "#d5ff45" };
    if (accuracy <= 15) return { label: "GPS bom", tone: "#63e6be" };
    if (accuracy <= 30) return { label: "GPS regular", tone: "#ffd43b" };
    return { label: "GPS fraco", tone: "#ff7a3d" };
  }, [hasSignal, accuracy]);

  // Diário de rota: fotos cravadas no trajeto com GPS, km e horário.
  const routePhotos = useRoutePhotos({
    sessionId: sessionId ?? "pending",
    pointsRef,
    distanceRef,
    elapsedMs: () => (startedAtRef.current ? Date.now() - startedAtRef.current : 0),
    accuracy,
  });
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  const handlePosition = useCallback(
    (pos: GeolocationPosition) => {
      const acc = pos.coords.accuracy ?? 0;
      setAccuracy(acc);
      setHasSignal(true);
      setUserPos([pos.coords.longitude, pos.coords.latitude]);
      const phaseNow = phaseRef.current;
      if (phaseNow !== "recording" && phaseNow !== "paused") return;
      if (acc > 60) {
        setToast("Sinal de GPS fraco — aguardando precisão melhor");
        return;
      }
      const t = Date.now();
      const alt = typeof pos.coords.altitude === "number" ? pos.coords.altitude : null;
      const last = pointsRef.current.length > 0 ? pointsRef.current[pointsRef.current.length - 1] : null;
      // Deslocamento real desde o último ponto válido (sempre calculado).
      const realDistance = last ? haversine(last.lat, last.lng, pos.coords.latitude, pos.coords.longitude) : 0;
      const dt = last ? (t - last.t) / 1000 : 0;
      // Velocidade derivada do deslocamento — a única fonte confiável.
      const stepSpeed = last && dt > 0.4 ? (realDistance / dt) * 3.6 : 0;

      // `coords.speed` é usado APENAS para reforçar movimento quando o GPS
      // reporta algo útil e coerente. Se vier 0 ou null (Safari), ignoramos:
      // o deslocamento real manda.
      const deviceSpeedRaw = typeof pos.coords.speed === "number" && pos.coords.speed > 0 ? pos.coords.speed * 3.6 : null;
      const speed = deviceSpeedRaw !== null && deviceSpeedRaw > stepSpeed ? deviceSpeedRaw : stepSpeed;

      if (speed > sport.plausibleMaxKmh) return; // ruído de GPS: ponto descartado

      if (alt !== null) {
        if (elevBaseRef.current === null) elevBaseRef.current = alt;
        const delta = alt - elevBaseRef.current;
        if (delta > 1.5) {
          gainRef.current += delta;
          elevBaseRef.current = alt;
        } else if (delta < -1.5) {
          lossRef.current += -delta;
          elevBaseRef.current = alt;
        }
      }

      if (last) {
        const d = haversine(last.lat, last.lng, pos.coords.latitude, pos.coords.longitude);
        if (d >= 2 && d < 220) distanceRef.current += d;
      }

      pointsRef.current.push({
        t,
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        acc,
        alt: alt ?? undefined,
        spd: speed,
      });

      // PAUSA AUTOMÁTICA (opcional, desligada por padrão).
      // Critério: deslocamento real acumulado menor que 8 m por 20 s seguidos.
      // Nada aqui roda se o usuário não ativou a opção.
      if (autoPauseOn && sport.supportsAutoPause) {
        if (phaseRef.current === "recording") {
          if (realDistance <= AUTO_PAUSE_MAX_STEP_M) {
            const win = stillWindowRef.current;
            if (!win || t - win.start > AUTO_PAUSE_WINDOW_SEC * 2) {
              stillWindowRef.current = { start: t, moved: realDistance };
            } else {
              win.moved += realDistance;
              // 20 s seguidos E menos de 8 m no total: parado de verdade.
              if (t - win.start >= AUTO_PAUSE_WINDOW_SEC && win.moved < AUTO_PAUSE_MIN_MOVE_M) {
                phaseRef.current = "paused";
                pausedAtRef.current = t;
                setPhase("paused");
                setAutoPaused(true);
                autoPausesRef.current += 1;
                stillWindowRef.current = null;
              }
            }
          } else {
            // Movimento real: zera a janela de parada imediatamente.
            stillWindowRef.current = null;
          }
        } else if (phaseRef.current === "paused" && autoPaused) {
          // Retomada também por deslocamento real, com janela de confirmação.
          if (realDistance > AUTO_PAUSE_RESUME_STEP_M) {
            const win = resumeWindowRef.current;
            if (!win || t - win.start > AUTO_PAUSE_RESUME_SEC * 2) {
              resumeWindowRef.current = { start: t, moved: realDistance };
            } else {
              win.moved += realDistance;
              if (t - win.start >= AUTO_PAUSE_RESUME_SEC && win.moved >= AUTO_PAUSE_RESUME_MOVE_M) {
                elapsedRef.current += pausedAtRef.current ? (t - pausedAtRef.current) / 1000 : 0;
                pausedAtRef.current = null;
                phaseRef.current = "recording";
                setPhase("recording");
                setAutoPaused(false);
                resumeWindowRef.current = null;
              }
            }
          } else {
            resumeWindowRef.current = null;
          }
        }
      }
    },
    [autoPauseOn, sport],
  );

  const startGps = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setGpsError("Este navegador não oferece suporte a GPS.");
      return;
    }
    setGpsError(null);
    watchRef.current = navigator.geolocation.watchPosition(
      handlePosition,
      (err) => {
        setGpsError(
          err.code === err.PERMISSION_DENIED
            ? "Permissão de localização negada. Ative o GPS para registrar o trajeto real."
            : "Não foi possível obter a localização. Procure um céu aberto.",
        );
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 },
    );
  }, [handlePosition]);

  const stopGps = useCallback(() => {
    if (watchRef.current !== null) {
      navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
    }
  }, []);

  // Wake Lock: mantém a tela ligada para o sistema não suspender o GPS.
  const isRecordingPhase = phase === "recording" || phase === "paused";
  const wakeLock = useWakeLock(isRecordingPhase);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = Date.now();
      if (phaseRef.current === "recording" && startedAtRef.current) {
        elapsedRef.current = (now - startedAtRef.current) / 1000 - (pausedAtRef.current ? (now - pausedAtRef.current) / 1000 : 0);
        movingRef.current += 0.5;
      }
      const track = pointsRef.current;
      const last = track.length > 0 ? track[track.length - 1] : null;
      setStats({
        distanceM: distanceRef.current,
        movingSec: movingRef.current,
        elapsedSec: Math.max(0, elapsedRef.current),
        gain: gainRef.current,
        loss: lossRef.current,
        maxSpeed: maxSpeedRef.current,
        currentSpeed: last?.spd ?? 0,
        calories: estimateCalories(sportKey, distanceRef.current, movingRef.current, weightKg),
        points: track.length,
        accuracy,
        altitude: last?.alt ?? null,
      });
      setRoute(track.map((p) => [p.lng, p.lat] as [number, number]));
    }, 500);
    return () => window.clearInterval(timer);
  }, [accuracy, sportKey, weightKg]);

  useEffect(() => {
    if (stats.currentSpeed > stats.maxSpeed) maxSpeedRef.current = stats.currentSpeed;
  }, [stats.currentSpeed, stats.maxSpeed]);

  // Persistência contínua: a cada ciclo do cronômetro salvamos o estado,
  // para que bloquear o celular ou recarregar não perca o trajeto.
  useEffect(() => {
    if (phase !== "recording" && phase !== "paused") return;
    saveRecordingState({
      sportKey,
      startedAt: startedAtRef.current ?? Date.now(),
      points: pointsRef.current,
      distanceM: distanceRef.current,
      movingSec: movingRef.current,
      gainM: gainRef.current,
      lossM: lossRef.current,
      maxSpeedKmh: maxSpeedRef.current,
      pauses: pausesRef.current,
      autoPauses: autoPausesRef.current,
    });
  }, [stats, phase, sportKey]);

  useEffect(() => {
    startGps();
    return () => {
      stopGps();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleStart() {
    startedAtRef.current = Date.now();
    pausedAtRef.current = null;
    stillWindowRef.current = null;
    resumeWindowRef.current = null;
    phaseRef.current = "recording";
    setPhase("recording");
  }

  function pause(manual: boolean) {
    if (phaseRef.current !== "recording") return;
    pausedAtRef.current = Date.now();
    phaseRef.current = "paused";
    setPhase("paused");
    setAutoPaused(!manual);
    if (manual) pausesRef.current += 1;
  }

  function resume() {
    if (phaseRef.current !== "paused") return;
    const now = Date.now();
    elapsedRef.current += pausedAtRef.current ? (now - pausedAtRef.current) / 1000 : 0;
    pausedAtRef.current = null;
    stillWindowRef.current = null;
    resumeWindowRef.current = null;
    phaseRef.current = "recording";
    setPhase("recording");
    setAutoPaused(false);
  }

  async function finish() {
    const track = pointsRef.current;
    if (track.length < 3 && !manualDistance && distanceRef.current < 50) {
      setToast("Atividade muito curta — continue se movendo ou informe a distância no modo indoor.");
      return;
    }
    setPhase("saving");
    stopGps();
    const elapsedSec = Math.round(
      Math.max(1, elapsedRef.current + (pausedAtRef.current ? (Date.now() - pausedAtRef.current) / 1000 : 0)),
    );
    const movingSec = Math.max(1, Math.round(movingRef.current));
    const distanceM = manualDistance ? Number(manualDistance) * 1000 : Math.round(distanceRef.current);
    const payload = {
      sport: sportKey,
      name: null,
      startedAt: new Date(startedAtRef.current ?? Date.now()).toISOString(),
      elapsedSec,
      movingSec,
      distanceM,
      maxSpeedKmh: Number(maxSpeedRef.current.toFixed(2)),
      elevGainM: Math.round(gainRef.current),
      elevLossM: Math.round(lossRef.current),
      calories: estimateCalories(sportKey, distanceM, movingSec, weightKg),
      pauses: pausesRef.current,
      autoPauses: autoPausesRef.current,
      gpsPoints: track.length,
      avgAccuracyM: track.length ? track.reduce((s, p) => s + (p.acc ?? 0), 0) / track.length : 0,
      device: deviceName,
      track,
    };
    try {
      const res = await fetch("/api/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as {
        ok: boolean;
        id?: number;
        error?: string;
        integrity?: { status: string; reason: string | null };
      };
      if (!res.ok || !json.ok || !json.id) throw new Error(json.error ?? "Falha ao salvar a atividade.");
      // Aviso imediato: o percurso não será validado, mas o registro é mantido.
      if (json.integrity && json.integrity.status !== "valid" && json.integrity.reason) {
        sessionStorage.setItem(`muv-integrity-${json.id}`, json.integrity.reason);
      }

      // Envia as fotos do diário de rota com suas geotags.
      const pending = routePhotos.photos.filter((p) => !p.uploaded);
      if (pending.length > 0 && json.id) {
        try {
          await fetch(`/api/activities/${json.id}/photos`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              photos: pending.map((p) => ({
                dataUrl: p.dataUrl,
                caption: p.caption,
                lat: p.lat,
                lng: p.lng,
                kmMark: p.kmMark,
                altitudeM: p.altitudeM,
                elapsedAtMs: p.elapsedAtMs,
              })),
            }),
          });
        } catch {
          // Falha de rede: as fotos permanecem no dispositivo e podem ser reenviadas.
        }
      }
      clearActiveSession();
      routePhotos.clearSession();
      router.push(`/app/activities/${json.id}/save`);
    } catch (error) {
      setPhase("error");
      setToast(error instanceof Error ? error.message : "Erro ao salvar atividade");
    }
  }

  const primaryMetric =
    sport.category === "ride"
      ? { value: formatDistance(stats.distanceM), label: "Distância" }
      : { value: formatDistance(stats.distanceM), label: "Distância" };

  const bigNumber =
    sport.category === "ride"
      ? { value: formatSpeed(stats.currentSpeed, 1), unit: "km/h", label: "Velocidade atual" }
      : { value: formatPace(stats.distanceM > 30 ? stats.movingSec / (stats.distanceM / 1000) : 0), unit: "/km", label: "Pace atual" };

  return (
    <div className="flex flex-col gap-3 pb-6">
      <div className="flex items-center justify-between gap-3 border-b border-line pb-3">
        <Link href="/app/record" className="grid size-10 place-items-center border border-line text-muted transition-colors hover:border-paper hover:text-paper" aria-label="Voltar">
          <Icon.back className="size-4" />
        </Link>
        <div className="flex items-center gap-2.5">
          <SportIcon sport={sportKey} className="size-6 text-lime" />
          <div>
            <p className="display-2 text-[14px]">{sport.label}</p>
            <p className="flex items-center gap-1.5 text-[10px] font-display font-bold uppercase tracking-[0.14em]" style={{ color: gpsQuality.tone }}>
              <span className="inline-block size-1.5 rounded-full" style={{ background: gpsQuality.tone }} />
              {gpsQuality.label}
              {accuracy ? ` · ${Math.round(accuracy)}m` : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {phase === "recording" || phase === "paused" ? (
            <>
              <button
                type="button"
                onClick={() => setPocket(true)}
                className="tap"
                aria-label="Modo bolso"
                title="Modo bolso: tela preta, sem toques acidentais"
              >
                <Icon.lock className="size-[18px]" />
              </button>
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                disabled={routePhotos.busy || routePhotos.photos.length >= MAX_PHOTOS_PER_ACTIVITY}
                className="tap"
                aria-label="Registrar foto no trajeto"
                title={`Foto no trajeto (${routePhotos.photos.length}/${MAX_PHOTOS_PER_ACTIVITY})`}
              >
                <Icon.camera className="size-[18px]" />
              </button>
              <span className="metric text-[10px] font-bold text-muted">
                {routePhotos.photos.length}/{MAX_PHOTOS_PER_ACTIVITY}
              </span>
            </>
          ) : null}
          <div className="metric flex size-10 flex-col items-center justify-center border border-line text-[11px] font-bold leading-none">
            {stats.points}
            <span className="mt-0.5 text-[8px] font-semibold text-muted">PTS</span>
          </div>
        </div>
      </div>

      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => {
          void routePhotos.addFromFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {resumed ? (
        <p className="fade border border-lime/40 bg-lime/8 px-3 py-2.5 text-[11px] leading-relaxed text-lime">
          Trajeto recuperado do último treino interrompido — continuamos somando de onde parou.
        </p>
      ) : null}
      {routePhotos.notice ? (
        <p className="fade border border-line bg-graphite px-3 py-2.5 text-[11px] text-muted">{routePhotos.notice}</p>
      ) : null}
      {routePhotos.photos.length > 0 ? (
        <div className="border border-line bg-graphite p-3">
          <div className="flex items-center justify-between">
            <p className="eyebrow">Diário de rota</p>
            <span className="metric text-[10px] font-bold text-muted">{formatBytes(routePhotos.totalBytes)}</span>
          </div>
          <div className="no-scrollbar mt-2.5 flex gap-2 overflow-x-auto">
            {routePhotos.photos.map((p) => (
              <div key={p.localId} className="relative shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.dataUrl} alt="Foto do trajeto" className="size-16 object-cover" />
                <span className="metric absolute bottom-0 left-0 right-0 bg-ink/80 py-0.5 text-center text-[9px] font-bold text-lime">
                  {p.kmMark.toFixed(1)} km
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Pausa automática: desligada por padrão, discreta e opcional */}
      <button
        type="button"
        onClick={() => toggleAutoPause(!autoPauseOn)}
        className="surface hover-lift flex w-full items-center gap-3 px-3.5 py-3 text-left"
        aria-pressed={autoPauseOn}
      >
        <span className="min-w-0 flex-1">
          <span className="block text-[12px] font-semibold">Pausa automática</span>
          <span className="block text-[10px] leading-snug text-muted">
            {autoPauseOn
              ? "Ligada · pausa após 20 s parado e retoma ao voltar a se mover"
              : "Desligada · o cronômetro continua mesmo se você parar"}
          </span>
        </span>
        <span
          className="relative flex h-[22px] w-[38px] shrink-0 items-center rounded-full transition-colors"
          style={{ background: autoPauseOn ? "#d5ff45" : "#2a2d33" }}
          aria-hidden="true"
        >
          <span
            className="absolute size-[16px] rounded-full transition-all"
            style={{
              left: autoPauseOn ? 20 : 3,
              background: autoPauseOn ? "#101112" : "#858b94",
            }}
          />
        </span>
      </button>

      {sport.outdoor ? (
        <div className="relative h-56 min-h-[224px] w-full border border-line">
          <MapView
            className="absolute inset-0"
            lines={[{ coords: route, color: sport.color, width: 6 }]}
            userPos={userPos}
            accuracyM={accuracy}
            follow={follow}
            onInteract={() => setFollow(false)}
          />
        </div>
      ) : (
        <div className="grid h-56 place-items-center border border-line bg-graphite-2 text-center text-[13px] text-muted">
          <div>
            <SportIcon sport={sportKey} className="mx-auto size-10 text-muted" />
            <p className="mt-3 font-display text-[13px] font-bold uppercase tracking-[0.14em] text-paper">Modo indoor</p>
            <p className="mx-auto mt-2 max-w-[240px] text-[11px] leading-relaxed">
              Tempo e calorias registrados pelo cronômetro. Informe a distância ao finalizar.
            </p>
            <input
              value={manualDistance}
              onChange={(e) => setManualDistance(e.target.value.replace(",", "."))}
              inputMode="decimal"
              placeholder="Distância em km"
              className="metric mt-3 w-40 border border-line bg-ink px-3 py-2 text-center text-[16px] font-bold"
            />
          </div>
        </div>
      )}

      <div className="border border-line bg-graphite px-5 py-6 text-center">
        <p className="text-[9px] font-display font-bold uppercase tracking-[0.2em] text-muted">{primaryMetric.label}</p>
        <p className="metric mt-2 text-[64px] font-black leading-[0.9]" style={{ color: sport.color }}>
          {primaryMetric.value}
        </p>
        <div className="mx-auto mt-4 flex items-baseline justify-center gap-1.5 border-t border-line pt-4">
          <p className="metric text-[30px] font-black leading-none">{bigNumber.value}</p>
          <span className="metric text-[12px] font-bold text-muted">{bigNumber.unit}</span>
        </div>
        <p className="mt-1.5 text-[9px] font-display font-bold uppercase tracking-[0.2em] text-muted">{bigNumber.label}</p>
      </div>

      <div className="grid grid-cols-2 gap-px border border-line bg-line">
        <Metric label="Tempo total" value={formatDuration(stats.elapsedSec, true)} />
        <Metric label="Em movimento" value={formatDuration(stats.movingSec, true)} />
        <Metric label="Altitude" value={stats.altitude !== null ? `${Math.round(stats.altitude)} m` : "—"} />
        <Metric label="Ganho acumulado" value={`${Math.round(stats.gain)} m`} accent="#d5ff45" />
        <Metric label="Vel. máxima" value={`${formatSpeed(stats.maxSpeed)} km/h`} />
        <Metric label="Vel. média" value={`${formatSpeed(stats.movingSec > 0 ? stats.distanceM / 1000 / (stats.movingSec / 3600) : 0)} km/h`} />
        <Metric label="Calorias" value={`${stats.calories} kcal`} accent="#ff6a3d" />
        <Metric label="Precisão GPS" value={`${Math.round(stats.accuracy)} m`} />
      </div>

      {gpsError ? <p className="border border-flame/40 bg-flame/10 px-4 py-3 text-[12px] text-flame">{gpsError}</p> : null}
      {autoPaused && phase === "paused" ? (
        <p className="border border-sky/40 bg-sky/10 px-4 py-3 text-[12px] text-sky">
          Pausa automática — você ficou parado 20 s. Retomando quando voltar a se mover.
        </p>
      ) : null}
      {toast ? <p className="border border-line bg-graphite px-4 py-3 text-[12px] text-muted">{toast}</p> : null}

      <div className="sticky bottom-20 z-10 mt-2 border-t border-line bg-ink/95 pt-3 backdrop-blur-md">
        {phase === "ready" ? (
          <button type="button" onClick={handleStart} className="btn btn-primary w-full py-4 text-[14px]">
            Iniciar {sport.label.toLowerCase()}
          </button>
        ) : null}
        {phase === "recording" ? (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => pause(true)}
              className="btn btn-dark flex-1 py-4 text-[13px]"
            >
              <Icon.pause className="size-4" /> Pausar
            </button>
            <button type="button" onClick={finish} className="btn flex-1 bg-flame py-4 text-[13px] text-ink hover:bg-[#ff7d55]">
              Finalizar
            </button>
          </div>
        ) : null}
        {phase === "paused" ? (
          <div className="flex gap-2">
            <button type="button" onClick={resume} className="btn btn-primary flex-1 py-4 text-[13px]">
              <Icon.play className="size-4" /> Continuar
            </button>
            <button type="button" onClick={finish} className="btn flex-1 bg-flame py-4 text-[13px] text-ink hover:bg-[#ff7d55]">
              Finalizar
            </button>
          </div>
        ) : null}
        {phase === "saving" ? <p className="py-4 text-center text-[13px] text-muted shimmer">Salvando atividade…</p> : null}
        {phase === "error" ? (
          <button type="button" onClick={finish} className="btn w-full bg-flame py-4 text-[13px] text-ink hover:bg-[#ff7d55]">
            Tentar salvar novamente
          </button>
        ) : null}
      </div>

      <div className="px-1 pb-2">
        <p className="text-[11px] leading-relaxed text-muted">
          Trajeto capturado pelo GPS real do dispositivo. Nenhum ponto é simulado: cada amostra guarda latitude, longitude,
          precisão, altitude e velocidade. Leituras com precisão acima de 60 m e saltos impossíveis são descartados.
        </p>
        <p className="mt-2 border border-line bg-graphite px-3 py-2 text-[11px] leading-relaxed text-muted">
          Limite desta modalidade: <span className="metric font-bold text-lime">{limitFor(sportKey)} km/h</span> sustentados.
          Ritmo acima disso indica uso de veículo e o percurso <span className="font-semibold text-paper">não conta</span> para
          recompensas e rankings.
        </p>
      </div>

      <PocketMode
        active={pocket}
        onDeactivate={() => setPocket(false)}
        elapsedSec={Math.round(stats.elapsedSec)}
        distanceM={stats.distanceM}
        sportAccent={sport.color}
      />
    </div>
  );
}

function Metric({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="bg-graphite px-3 py-2.5">
      <p className="text-[9px] font-display font-bold uppercase tracking-[0.16em] text-muted">{label}</p>
      <p className="metric mt-0.5 text-[17px] font-bold" style={accent ? { color: accent } : undefined}>
        {value}
      </p>
    </div>
  );
}
