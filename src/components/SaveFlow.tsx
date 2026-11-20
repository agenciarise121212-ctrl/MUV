"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { formatDistance, formatDuration, formatPace, formatSpeed } from "@/lib/format";
import { getSport, isRideSport } from "@/lib/sports";
import { Icon } from "@/components/icons.client";
import { integrityBadge, type IntegrityStatus } from "@/lib/anticheat";

type PendingPhoto = { key: string; dataUrl: string; caption: string; savedId?: number };

type Summary = {
  xpEarned: number;
  coinsEarned: number;
  totalXp: number;
  totalCoins: number;
  level: { level: number; title: string; pct: number };
  newAchievements: { key: string; name: string; icon: string; description: string; xpReward: number }[];
  territoriesClaimed: { name: string; emoji: string; distanceInsideM: number }[];
  records: { label: string; value: string; unit: string; formatted?: string }[];
  challenges: { name: string; progress: number; target: number; unit: string; completed: boolean }[];
  segmentEfforts: { segment: string; elapsedSec: number; cr: boolean }[];
};

export function SaveFlow({
  activity,
  initialPhotos,
  alreadyPublished,
}: {
  activity: {
    id: number;
    sport: string;
    name: string;
    notes: string | null;
    location: string | null;
    visibility: string;
    distanceM: number;
    movingSec: number;
    elapsedSec: number;
    elevGainM: number;
    calories: number;
    avgSpeedKmh: number;
    paceSecPerKm: number;
    gpsPoints: number;
    isIndoor: boolean;
  };
  initialPhotos: { id: number; caption: string | null }[];
  alreadyPublished: boolean;
}) {
  const router = useRouter();
  const sport = getSport(activity.sport);
  const isRide = isRideSport(activity.sport);
  const galleryRef = useRef<HTMLInputElement | null>(null);
  const cameraRef = useRef<HTMLInputElement | null>(null);
  const dragIndex = useRef<number | null>(null);

  const [photos, setPhotos] = useState<PendingPhoto[]>(
    initialPhotos.map((p) => ({ key: `saved-${p.id}`, dataUrl: `/api/photos/${p.id}`, caption: p.caption ?? "", savedId: p.id })),
  );
  const [name, setName] = useState(activity.name);
  const [notes, setNotes] = useState(activity.notes ?? "");
  const [location, setLocation] = useState(activity.location ?? "");
  const [visibility, setVisibility] = useState(activity.visibility);
  const [commute, setCommute] = useState(false);
  const [distance, setDistance] = useState(String((activity.distanceM / 1000).toFixed(2)));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [integrity, setIntegrity] = useState<{ status: IntegrityStatus; reason: string | null }>(() => {
    if (typeof window === "undefined") return { status: "valid", reason: null };
    const stored = window.sessionStorage.getItem(`muv-integrity-${activity.id}`);
    window.sessionStorage.removeItem(`muv-integrity-${activity.id}`);
    return { status: (stored ? "suspicious" : "valid") as IntegrityStatus, reason: stored };
  });

  async function compress(file: File): Promise<string> {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("Falha ao ler arquivo"));
      reader.readAsDataURL(file);
    });
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Imagem inválida"));
      image.src = dataUrl;
    });
    const maxSide = 1600;
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return dataUrl;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.82);
  }

  async function addFiles(fileList: FileList | null) {
    if (!fileList) return;
    setError(null);
    const incoming: PendingPhoto[] = [];
    for (const file of Array.from(fileList).slice(0, 10)) {
      if (!file.type.startsWith("image/")) continue;
      try {
        incoming.push({ key: `new-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, dataUrl: await compress(file), caption: "" });
      } catch {
        setError("Não foi possível processar uma das imagens.");
      }
    }
    setPhotos((prev) => [...prev, ...incoming]);
  }

  function move(from: number, to: number) {
    if (to < 0 || to >= photos.length) return;
    setPhotos((prev) => {
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  }

  async function removePhoto(photo: PendingPhoto, index: number) {
    if (photo.savedId) {
      await fetch(`/api/activities/${activity.id}/photos`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoId: photo.savedId }),
      });
    }
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  }

  async function uploadPhotos() {
    const pending = photos.filter((p) => !p.savedId);
    if (pending.length === 0) return;
    const res = await fetch(`/api/activities/${activity.id}/photos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photos: pending.map((p) => ({ dataUrl: p.dataUrl, caption: p.caption })) }),
    });
    const json = (await res.json()) as { ok: boolean; ids?: number[]; error?: string };
    if (!json.ok) throw new Error(json.error ?? "Falha no upload das fotos");
    let cursor = 0;
    setPhotos((prev) =>
      prev.map((p) => {
        if (p.savedId) return p;
        const savedId = json.ids?.[cursor];
        cursor += 1;
        return { ...p, savedId };
      }),
    );
  }

  async function publish() {
    setBusy(true);
    setError(null);
    try {
      await uploadPhotos();
      const order = photos.map((p, index) => ({ id: p.savedId, position: index, caption: p.caption }));
      if (order.length > 0) {
        await fetch(`/api/activities/${activity.id}/photos`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ order }),
        });
      }
      const res = await fetch(`/api/activities/${activity.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          notes,
          location,
          visibility,
          commute,
          publish: !alreadyPublished,
          distanceM: activity.isIndoor ? Math.round(Number(distance || "0") * 1000) : undefined,
        }),
      });
      const json = (await res.json()) as { ok: boolean; summary?: Summary; error?: string };
      if (!json.ok) throw new Error(json.error ?? "Falha ao publicar");
      if (json.summary) setSummary(json.summary);
      else router.push(`/app/activities/${activity.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao publicar atividade");
    } finally {
      setBusy(false);
    }
  }

  if (summary) {
    return (
      <div className="rise space-y-4 pb-6">
        <div className="border border-line bg-graphite p-5 text-center">
          <p className="text-3xl">🎉</p>
          <p className="mt-2 text-lg font-black">{activity.isIndoor ? "Treino registrado!" : "Atividade publicada!"}</p>
          <p className="text-[13px] text-muted">{sport.emoji} {sport.label}</p>
          <div className="mt-4 flex justify-center gap-6">
            <div>
              <p className="tabular text-2xl font-black text-lime">+{summary.xpEarned}</p>
              <p className="text-[11px] uppercase tracking-wider text-muted">XP</p>
            </div>
            <div>
              <p className="tabular text-2xl font-black text-amber-300">+{summary.coinsEarned}</p>
              <p className="text-[11px] uppercase tracking-wider text-muted">moedas</p>
            </div>
          </div>
          <p className="mt-3 text-[12px] text-muted">
            Nível {summary.level.level} · {summary.level.title}
          </p>
        </div>

        {summary.records.length > 0 ? (
          <Section emoji="🏅" title="Recordes pessoais">
            {summary.records.map((r) => (
              <li key={r.label} className="flex justify-between bg-graphite-2 px-3 py-2 text-sm">
                <span>{r.label}</span>
                <span className="font-bold text-lime">{r.formatted ?? r.value}</span>
              </li>
            ))}
          </Section>
        ) : null}

        {summary.newAchievements.length > 0 ? (
          <Section emoji="🏆" title="Conquistas desbloqueadas">
            {summary.newAchievements.map((a) => (
              <li key={a.key} className="bg-graphite-2 px-3 py-2">
                <p className="text-[14px] font-semibold">
                  {a.icon} {a.name} <span className="text-[11px] font-semibold text-lime">+{a.xpReward} XP</span>
                </p>
                <p className="text-[11px] text-muted">{a.description}</p>
              </li>
            ))}
          </Section>
        ) : null}

        {summary.territoriesClaimed.length > 0 ? (
          <Section emoji="🗺️" title="Territórios dominados">
            {summary.territoriesClaimed.map((t) => (
              <li key={t.name} className="flex justify-between bg-graphite-2 px-3 py-2 text-sm">
                <span>
                  {t.emoji} {t.name}
                </span>
                <span className="font-bold text-sky">{formatDistance(t.distanceInsideM)} dentro</span>
              </li>
            ))}
          </Section>
        ) : null}

        {summary.records.length === 0 && summary.newAchievements.length === 0 && summary.territoriesClaimed.length === 0 ? (
          <p className="text-center text-[13px] text-muted">Continue treinando para desbloquear conquistas, territórios e recordes.</p>
        ) : null}

        <button type="button" onClick={() => router.push(`/app/activities/${activity.id}`)} className="btn btn-primary w-full py-3.5">
          Ver atividade
        </button>
        <button type="button" onClick={() => router.push("/app")} className="w-full bg-graphite-2 py-3 text-[14px] font-semibold text-muted hairline">
          Voltar ao feed
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-8">
      <div className="border border-line bg-graphite p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Resumo do treino</p>
        <div className="mt-3 flex gap-5">
          <div>
            <p className="tabular text-2xl font-black" style={{ color: sport.color }}>{formatDistance(activity.distanceM)}</p>
            <p className="text-[10px] uppercase tracking-wider text-muted">Distância</p>
          </div>
          <div>
            <p className="tabular text-2xl font-black">{isRide ? `${formatSpeed(activity.avgSpeedKmh)} ` : formatPace(activity.paceSecPerKm)}</p>
            <p className="text-[10px] uppercase tracking-wider text-muted">{isRide ? "km/h média" : "pace médio"}</p>
          </div>
          <div>
            <p className="tabular text-2xl font-black">{formatDuration(activity.movingSec, true)}</p>
            <p className="text-[10px] uppercase tracking-wider text-muted">Tempo</p>
          </div>
        </div>
        <p className="mt-3 text-[11px] text-muted">
          {activity.gpsPoints} pontos GPS · {Math.round(activity.elevGainM)} m de ganho · {activity.calories} kcal
        </p>
      </div>

      <div className="border border-line bg-graphite p-4">
        <div className="flex items-center justify-between">
          <p className="text-[14px] font-semibold">Fotos da atividade</p>
          <span className="text-[11px] text-muted">{photos.length} selecionada(s)</span>
        </div>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => galleryRef.current?.click()}
            className="flex flex-1 items-center justify-center gap-2 bg-graphite-2 py-2.5 text-[14px] font-semibold hairline"
          >
            <Icon.camera className="size-4" /> Galeria
          </button>
          <button
            type="button"
            onClick={() => cameraRef.current?.click()}
            className="flex flex-1 items-center justify-center gap-2  bg-lime py-2.5 text-[14px] font-semibold text-ink"
          >
            <Icon.camera className="size-4" /> Câmera
          </button>
        </div>
        <input ref={galleryRef} type="file" accept="image/*" multiple onChange={(e) => void addFiles(e.target.files)} />
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={(e) => void addFiles(e.target.files)} />

        {photos.length > 0 ? (
          <ul className="mt-3 space-y-2">
            {photos.map((photo, index) => (
              <li
                key={photo.key}
                draggable
                onDragStart={() => {
                  dragIndex.current = index;
                }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragIndex.current !== null) move(dragIndex.current, index);
                  dragIndex.current = null;
                }}
                className="flex gap-3 bg-graphite-2 p-2 hairline"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.dataUrl} alt="Foto selecionada" className="size-20 shrink-0 rounded-lg object-cover" />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <input
                    value={photo.caption}
                    onChange={(e) =>
                      setPhotos((prev) => prev.map((p, i) => (i === index ? { ...p, caption: e.target.value } : p)))
                    }
                    placeholder="Legenda da foto"
                    className="w-full rounded-lg bg-ink px-2.5 py-1.5 text-xs hairline"
                  />
                  <div className="flex items-center gap-1 text-muted">
                    <button type="button" onClick={() => move(index, index - 1)} className="rounded-md bg-ink px-2 py-1 text-[11px] hairline">
                      ← mover
                    </button>
                    <button type="button" onClick={() => move(index, index + 1)} className="rounded-md bg-ink px-2 py-1 text-[11px] hairline">
                      mover →
                    </button>
                    <button type="button" onClick={() => void removePhoto(photo, index)} className="ml-auto rounded-md bg-flame/15 px-2 py-1 text-[11px] text-flame">
                      remover
                    </button>
                  </div>
                  <p className="text-[10px] text-muted">Arraste para reordenar · posição {index + 1}</p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-[12px] text-muted">
            Adicione fotos para publicar junto com o mapa e os dados do treino — como no Strava. Você pode tirar fotos na hora ou
            escolher da galeria, reordenar e escrever legendas.
          </p>
        )}
      </div>

      <div className="border border-line bg-graphite p-4">
        <label className="text-[11px] font-semibold uppercase tracking-wider text-muted">Título</label>
        <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full bg-ink px-3 py-2 text-sm hairline" />
        <label className="mt-3 block text-[11px] font-semibold uppercase tracking-wider text-muted">Local</label>
        <input
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Ex: Parque Ibirapuera, São Paulo"
          className="mt-1 w-full bg-ink px-3 py-2 text-sm hairline"
        />
        <label className="mt-3 block text-[11px] font-semibold uppercase tracking-wider text-muted">Descrição</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="mt-1 w-full bg-ink px-3 py-2 text-sm hairline" />
        {activity.isIndoor ? (
          <>
            <label className="mt-3 block text-[11px] font-semibold uppercase tracking-wider text-muted">Distância indoor (km)</label>
            <input value={distance} onChange={(e) => setDistance(e.target.value)} inputMode="decimal" className="mt-1 w-32 bg-ink px-3 py-2 text-sm hairline" />
          </>
        ) : null}
        <label className="mt-3 block text-[11px] font-semibold uppercase tracking-wider text-muted">Visibilidade</label>
        <select value={visibility} onChange={(e) => setVisibility(e.target.value)} className="mt-1 w-full bg-ink px-3 py-2 text-sm hairline">
          <option value="public">Todos os atletas</option>
          <option value="followers">Apenas quem eu sigo</option>
          <option value="private">Somente eu</option>
        </select>
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={commute} onChange={(e) => setCommute(e.target.checked)} className="size-4 accent-volt" />
          Marcar como deslocamento (commute)
        </label>
      </div>

      {error ? <p className=" bg-flame/10 px-4 py-3 text-xs text-flame">{error}</p> : null}

      <div className="flex gap-2">
        <button type="button" onClick={publish} disabled={busy} className="btn btn-primary flex-1 py-3.5">
          {busy ? "Salvando…" : alreadyPublished ? "Salvar alterações" : "Publicar atividade"}
        </button>
      </div>
      <p className="text-[11px] text-muted">
        Ao publicar, o sistema recalcula XP, conquistas, territórios, recordes pessoais, desafios e segmentos com base nos dados
        reais registrados pelo GPS.
      </p>
    </div>
  );
}

function Section({ emoji, title, children }: { emoji: string; title: string; children: React.ReactNode }) {
  return (
    <div className="border border-line bg-graphite p-4">
      <p className="text-[14px] font-semibold">
        {emoji} {title}
      </p>
      <ul className="mt-2 space-y-1.5">{children}</ul>
    </div>
  );
}
