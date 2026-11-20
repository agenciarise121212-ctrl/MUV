"use client";

import { useEffect, useRef, useState } from "react";
import { formatDistance, formatDuration } from "@/lib/format";
import { haversine } from "@/lib/geo";

/**
 * Modo Bolso: overlay preto absoluto (#000000) que economiza bateria em telas
 * OLED e bloqueia toques acidentais nos controles de pausar/finalizar.
 *
 * Exibe apenas o essencial em baixa opacidade (tempo, distância) e exige um
 * deslize deliberado para desbloquear — nada de pausar o treino por engano
 * dentro do bolso.
 */
export function PocketMode({
  active,
  onDeactivate,
  elapsedSec,
  distanceM,
  sportAccent,
}: {
  active: boolean;
  onDeactivate: () => void;
  elapsedSec: number;
  distanceM: number;
  sportAccent: string;
}) {
  const [dragX, setDragX] = useState(0);
  const [unlocked, setUnlocked] = useState(false);
  const startX = useRef<number | null>(null);
  const THRESHOLD = 96;

  useEffect(() => {
    if (!active) {
      setUnlocked(false);
      setDragX(0);
      startX.current = null;
    }
  }, [active]);

  if (!active) return null;

  const progress = Math.min(1, Math.abs(dragX) / THRESHOLD);

  return (
    <div className="fixed inset-0 z-[80] select-none" style={{ background: "#000000" }}>
      {/* Métricas essenciais em baixa opacidade — legível sem iluminar a tela */}
      <div className="pointer-events-none flex h-full flex-col items-center justify-center gap-10 px-6">
        <div className="text-center">
          <p className="text-[9px] font-display font-bold uppercase tracking-[0.24em] text-paper/25">Tempo</p>
          <p className="metric mt-2 text-[44px] font-black leading-none text-paper/35">{formatDuration(elapsedSec, true)}</p>
        </div>
        <div className="text-center">
          <p className="text-[9px] font-display font-bold uppercase tracking-[0.24em] text-paper/25">Distância</p>
          <p className="metric mt-2 text-[34px] font-black leading-none" style={{ color: sportAccent, opacity: 0.32 }}>
            {formatDistance(distanceM)}
          </p>
        </div>
        <p className="mt-2 text-center text-[10px] leading-relaxed text-paper/15">
          Modo bolso ativo · GPS continuamente gravado
        </p>
      </div>

      {/* Deslize para desbloquear */}
      <div className="absolute inset-x-0 bottom-0 pb-[max(env(safe-area-inset-bottom),20px)]">
        <div className="relative mx-auto w-full max-w-[320px] px-6">
          <div className="relative h-12 overflow-hidden rounded-full border border-paper/10">
            <div
              className="absolute inset-y-0 left-0 rounded-full"
              style={{ width: `${Math.max(6, progress * 100)}%`, background: "rgba(213,255,69,0.16)" }}
            />
            <button
              type="button"
              aria-label="Deslize para desbloquear"
              className="absolute inset-y-1 left-1 grid w-[52px] place-items-center rounded-full border border-paper/20 bg-paper/10 backdrop-blur-sm"
              style={{ transform: `translateX(${Math.max(0, dragX)}px)` }}
              onTouchStart={(e) => {
                startX.current = e.touches[0]?.clientX ?? null;
              }}
              onTouchMove={(e) => {
                if (startX.current === null) return;
                const x = e.touches[0]?.clientX ?? 0;
                setDragX(Math.max(0, x - startX.current));
              }}
              onTouchEnd={() => {
                if (Math.abs(dragX) >= THRESHOLD) {
                  setUnlocked(true);
                  onDeactivate();
                } else {
                  setDragX(0);
                }
                startX.current = null;
              }}
              onMouseDown={(e) => {
                startX.current = e.clientX;
              }}
              onMouseMove={(e) => {
                if (startX.current === null) return;
                setDragX(Math.max(0, e.clientX - startX.current));
              }}
              onMouseUp={() => {
                if (Math.abs(dragX) >= THRESHOLD) onDeactivate();
                else setDragX(0);
                startX.current = null;
              }}
              onMouseLeave={() => {
                if (startX.current !== null) {
                  if (Math.abs(dragX) >= THRESHOLD) onDeactivate();
                  else setDragX(0);
                  startX.current = null;
                }
              }}
            >
              <svg viewBox="0 0 24 24" className="size-5 text-paper/45" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="5" y="10.2" width="14" height="9.8" />
                <path d="M8.2 10.2V8a3.8 3.8 0 0 1 7.6 0v2.2" />
              </svg>
            </button>
            <span className="pointer-events-none absolute inset-0 grid place-items-center text-[9px] font-display font-bold uppercase tracking-[0.16em] text-paper/30">
              {unlocked ? "Desbloqueado" : "Deslize para desbloquear"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Screen Wake Lock: mantém a tela ligada para o sistema não suspender o GPS
 * durante a gravação. Reativa automaticamente quando o usuário volta para a aba.
 */
export function useWakeLock(enabled: boolean) {
  const lockRef = useRef<{ release: () => Promise<void>; released?: boolean } | null>(null);
  const [supported, setSupported] = useState(false);
  const [active, setActive] = useState(false);

  const acquire = async () => {
    if (!enabled) return;
    const nav = navigator as Navigator & {
      wakeLock?: { request: (type: "screen") => Promise<{ release: () => Promise<void>; released?: boolean }> };
    };
    try {
      if (!nav.wakeLock) return;
      lockRef.current = await nav.wakeLock.request("screen");
      setSupported(true);
      setActive(true);
    } catch {
      // Sem suporte ou negado pelo sistema: a gravação continua normalmente.
      setSupported(false);
      setActive(false);
    }
  };

  const release = async () => {
    try {
      await lockRef.current?.release();
    } catch {
      /* já liberado */
    }
    lockRef.current = null;
    setActive(false);
  };

  useEffect(() => {
    if (!enabled) {
      void release();
      return;
    }
    void acquire();

    // Reativa ao voltar para a aba (iOS/Android liberam o lock em background).
    const onVisible = () => {
      if (document.visibilityState === "visible" && enabled) void acquire();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      void release();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  return { supported, active };
}

/** Chave do treino ativo no localStorage — estável entre recarregamentos. */
export function activeSessionKey(): string {
  const raw = window.localStorage.getItem("muv-active-session");
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as { key: string; startedAt: number };
      // Sessão válida por 12h; depois é considerada abandonada.
      if (parsed?.key && Date.now() - parsed.startedAt < 12 * 3600000) return parsed.key;
    } catch {
      /* ignora e cria nova */
    }
  }
  const key = `s-${Date.now().toString(36)}`;
  window.localStorage.setItem("muv-active-session", JSON.stringify({ key, startedAt: Date.now() }));
  return key;
}

export function clearActiveSession() {
  window.localStorage.removeItem("muv-active-session");
  window.localStorage.removeItem("muv-recording-state");
}

/** Estado de gravação persistido — permite retomar o trajeto após recarregar. */
export type PersistedRecording = {
  sportKey: string;
  startedAt: number;
  points: { t: number; lat: number; lng: number; acc?: number; alt?: number; spd?: number }[];
  distanceM: number;
  movingSec: number;
  gainM: number;
  lossM: number;
  maxSpeedKmh: number;
  pauses: number;
  autoPauses: number;
};

const REC_STATE_KEY = "muv-recording-state";

export function saveRecordingState(state: PersistedRecording) {
  try {
    window.localStorage.setItem(REC_STATE_KEY, JSON.stringify(state));
  } catch {
    // Quota: mantém em memória apenas.
  }
}

export function loadRecordingState(): PersistedRecording | null {
  try {
    const raw = window.localStorage.getItem(REC_STATE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedRecording & { startedAt: number };
    // Sessão de treino válida por 12h.
    if (!parsed?.points?.length || Date.now() - parsed.startedAt > 12 * 3600000) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function dropRecordingState() {
  window.localStorage.removeItem(REC_STATE_KEY);
}

export { REC_STATE_KEY };
