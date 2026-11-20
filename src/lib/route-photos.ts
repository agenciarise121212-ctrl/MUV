"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { haversine } from "@/lib/geo";
import type { TrackPoint } from "@/db/schema";
import { compressImage, formatBytes, type CompressedImage } from "@/lib/image";

/**
 * Diário de rota: fotos tiradas durante a gravação, cravadas no trajeto.
 *
 * Cada foto guarda a coordenada GPS do momento, o quilômetro do treino e o
 * carimbo de tempo — o que permite posicionar o marcador sobre a linha do
 * percurso e reproduzir o momento no replay animado.
 */

export type RoutePhoto = {
  localId: string;
  dataUrl: string;
  mimeType: string;
  bytes: number;
  width: number;
  height: number;
  lat: number;
  lng: number;
  kmMark: number;
  /** Distância acumulada (m) no instante da foto. */
  distanceM: number;
  /** Milissegundos desde o início do treino. */
  elapsedAtMs: number;
  altitudeM: number | null;
  /** Momento de parede (ISO) — usado como carimbo editorial. */
  takenAt: string;
  caption: string;
  /** true quando a foto concluir um check-in fotográfico. */
  questId?: number;
  /** true quando já foi enviada ao servidor. */
  uploaded?: boolean;
  serverId?: number;
};

const STORAGE_KEY = "muv-route-photos";

function readStore(): Record<string, RoutePhoto[]> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, RoutePhoto[]>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeStore(all: Record<string, RoutePhoto[]>) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    // Quota cheia: mantém apenas em memória (as fotos ainda são enviadas).
  }
}

type Params = {
  /** Chave do treino ativo no localStorage (id da atividade ou timestamp). */
  sessionId: string;
  pointsRef: React.RefObject<TrackPoint[]>;
  /** Distância acumulada (m) — vem do cronômetro de gravação. */
  distanceRef: React.RefObject<number>;
  /** Milissegundos desde o início do treino. */
  elapsedMs: () => number;
  /** Precisão atual do GPS (m). */
  accuracy: number;
  /** Missão de check-in aguardando foto (id), se houver. */
  pendingQuestId?: number | null;
};

export function useRoutePhotos({ sessionId, pointsRef, distanceRef, elapsedMs, accuracy, pendingQuestId }: Params) {
  const [photos, setPhotos] = useState<RoutePhoto[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const photosRef = useRef<RoutePhoto[]>([]);
  const hydratedRef = useRef(false);

  // Hidrata as fotos do treino anterior (recuperação após recarregamento).
  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    const store = readStore();
    const saved = store[sessionId];
    if (Array.isArray(saved) && saved.length > 0) {
      setPhotos(saved);
      photosRef.current = saved;
    }
  }, [sessionId]);

  // Persiste a cada mudança para sobreviver a recarregamento.
  useEffect(() => {
    if (!hydratedRef.current) return;
    const store = readStore();
    store[sessionId] = photos;
    writeStore(store);
  }, [photos, sessionId]);

  const flash = useCallback((message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(null), 2800);
  }, []);

  /** Última posição conhecida da trilha, com fallback para precisão do GPS. */
  const currentPosition = useCallback((): { lat: number; lng: number; alt: number | null } | null => {
    const track = pointsRef.current ?? [];
    if (track.length > 0) {
      const last = track[track.length - 1];
      return { lat: last.lat, lng: last.lng, alt: typeof last.alt === "number" ? last.alt : null };
    }
    return null;
  }, [pointsRef]);

  /** Adiciona uma foto capturada pela câmera do dispositivo. */
  const addFromFiles = useCallback(
    async (files: FileList | File[] | null): Promise<RoutePhoto[]> => {
      if (!files || files.length === 0) return [];
      const position = currentPosition();
      if (!position) {
        flash("Sem sinal de GPS ainda — a foto não será cravada no mapa.");
        return [];
      }

      setBusy(true);
      const created: RoutePhoto[] = [];
      try {
        for (const file of Array.from(files)) {
          if (!file.type.startsWith("image/")) continue;
          const shot: CompressedImage = await compressImage(file);
          const now = elapsedMs();
          const photo: RoutePhoto = {
            localId: `p-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            dataUrl: shot.dataUrl,
            mimeType: shot.mimeType,
            bytes: shot.bytes,
            width: shot.width,
            height: shot.height,
            lat: position.lat,
            lng: position.lng,
            kmMark: Number(((distanceRef.current ?? 0) / 1000).toFixed(3)),
            distanceM: Math.round(distanceRef.current ?? 0),
            elapsedAtMs: now,
            altitudeM: position.alt,
            takenAt: new Date().toISOString(),
            caption: "",
            questId: pendingQuestId ?? undefined,
          };
          created.push(photo);
        }

        if (created.length === 0) return [];

        setPhotos((prev) => {
          const next = [...prev, ...created];
          photosRef.current = next;
          return next;
        });
        const total = created.reduce((sum, p) => sum + p.bytes, 0);
        flash(
          `${created.length} foto${created.length > 1 ? "s" : ""} cravada${created.length > 1 ? "s" : ""} no trajeto · ${formatBytes(total)}`,
        );
        return created;
      } catch (error) {
        flash(error instanceof Error ? error.message : "Não foi possível processar a foto.");
        return [];
      } finally {
        setBusy(false);
      }
    },
    [currentPosition, distanceRef, elapsedMs, flash, pendingQuestId],
  );

  /** Marca uma foto como enviada (após o upload para o servidor). */
  const markUploaded = useCallback((localId: string, serverId: number) => {
    setPhotos((prev) => {
      const next = prev.map((p) => (p.localId === localId ? { ...p, uploaded: true, serverId } : p));
      photosRef.current = next;
      return next;
    });
  }, []);

  const removePhoto = useCallback((localId: string) => {
    setPhotos((prev) => {
      const next = prev.filter((p) => p.localId !== localId);
      photosRef.current = next;
      return next;
    });
  }, []);

  const clearSession = useCallback(
    (nextSessionId?: string) => {
      const store = readStore();
      delete store[sessionId];
      writeStore(store);
      setPhotos([]);
      photosRef.current = [];
      if (nextSessionId) hydratedRef.current = false;
    },
    [sessionId],
  );

  const totalBytes = photos.reduce((sum, p) => sum + p.bytes, 0);

  return {
    photos,
    addFromFiles,
    markUploaded,
    removePhoto,
    clearSession,
    busy,
    notice,
    totalBytes,
    accuracy,
    hasPosition: currentPosition() !== null,
  };
}

/** Encontra o ponto da trilha mais próximo de uma coordenada (para o replay). */
export function nearestTrackIndex(track: { lat: number; lng: number }[], lat: number, lng: number): number {
  let best = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let i = 0; i < track.length; i += 1) {
    const d = haversine(track[i].lat, track[i].lng, lat, lng);
    if (d < bestDistance) {
      bestDistance = d;
      best = i;
    }
  }
  return best;
}

export { formatBytes };
