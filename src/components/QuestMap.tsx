"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import MapCanvas, { type MapCircle, type MapEmblem, type MapLine } from "@/components/MapCanvas";
import { BottomSheet } from "@/components/BottomSheet";
import { EmblemIcon } from "@/components/EmblemIcon";
import { Icon } from "@/components/icons.client";
import { CATEGORY_META, type QuestCategory } from "@/lib/emblems";
import {
  DIFFICULTY_META,
  QUEST_STAT_LABEL,
  TIER_LABEL,
  formatCountdown,
  formatQuestDistance,
  gpsReadiness,
  questProgressLabel,
  type QuestView,
} from "@/lib/quest-ui";
import { haversine } from "@/lib/geo";

type SerializedQuest = Omit<QuestView, "waypoints"> & { waypoints: { lat: number; lng: number; label: string; order: number }[] };

type Props = {
  initialQuests: SerializedQuest[];
  territories: MapCircle[];
  territoryLines: MapLine[];
  segmentLines: MapLine[];
  ownedTerritories: number;
  totalTerritories: number;
};

type Filters = { categories: Record<string, boolean>; showCompleted: boolean };

const CATEGORY_KEYS: QuestCategory[] = ["mission", "special", "chest", "secret", "boss", "explore", "checkpoint"];

/** Animação de descoberta/captura. */
function CaptureReveal({ quest, xp, coins, onClose }: { quest: QuestView; xp: number; coins: number; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[70] flex flex-col items-center justify-center bg-ink/94 px-6 text-center">
      <div className="capture-burst absolute" aria-hidden="true" />
      <div className="capture-pop relative">
        <EmblemIcon emblem={quest.emblem} size={132} scale={1.04} className="mx-auto" />
      </div>
      <p className="eyebrow mt-8">{quest.kindLabel}</p>
      <h2 className="display-1 mt-2 text-[26px]">{quest.name}</h2>
      <div className="mt-6 grid w-full max-w-[280px] grid-cols-2 gap-px border border-line bg-line">
        <div className="bg-graphite px-4 py-4">
          <p className="metric text-[22px] font-black text-lime">+{xp}</p>
          <p className="mt-0.5 text-[9px] font-display font-bold uppercase tracking-[0.16em] text-muted">XP</p>
        </div>
        <div className="bg-graphite px-4 py-4">
          <p className="metric text-[22px] font-black text-lime">+{coins}</p>
          <p className="mt-0.5 text-[9px] font-display font-bold uppercase tracking-[0.16em] text-muted">moedas</p>
        </div>
      </div>
      <button type="button" onClick={onClose} className="btn btn-primary mt-8 w-full max-w-[280px]">
        Continuar explorando
      </button>
    </div>
  );
}

export function QuestMap({ initialQuests, territories, territoryLines, segmentLines, ownedTerritories, totalTerritories }: Props) {
  const [quests, setQuests] = useState<QuestView[]>(initialQuests as QuestView[]);
  const [pos, setPos] = useState<[number, number] | null>(null);
  const [accuracy, setAccuracy] = useState(0);
  const [speed, setSpeed] = useState<number | null>(null);
  const [gpsState, setGpsState] = useState<"idle" | "ok" | "denied">("idle");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [captured, setCaptured] = useState<{ quest: QuestView; xp: number; coins: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [nearId, setNearId] = useState<number | null>(null);
  const [layers, setLayers] = useState({ quests: true, territories: true, segments: false, position: true });
  const [filters, setFilters] = useState<Filters>({ categories: {}, showCompleted: false });
  const lastSyncRef = useRef<{ at: number; lat: number; lng: number } | null>(null);
  const prevPosRef = useRef<{ lat: number; lng: number; t: number } | null>(null);
  const firstSyncRef = useRef(true);

  const gps = gpsReadiness(accuracy);

  /* --------------------------- GPS real do dispositivo --------------------------- */
  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setGpsState("denied");
      return;
    }
    const id = navigator.geolocation.watchPosition(
      (p) => {
        const next = { lat: p.coords.latitude, lng: p.coords.longitude, t: Date.now() };
        setPos([next.lng, next.lat]);
        setAccuracy(p.coords.accuracy ?? 0);
        setGpsState("ok");
        const prev = prevPosRef.current;
        if (prev) {
          const dt = (next.t - prev.t) / 1000;
          if (dt > 1.5) {
            const d = haversine(prev.lat, prev.lng, next.lat, next.lng);
            setSpeed(Math.min(120, (d / dt) * 3.6));
          }
        }
        prevPosRef.current = next;
      },
      () => setGpsState("denied"),
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  /* ------------------------- Sincronização com o servidor ------------------------- */
  const sync = useCallback(
    async (force = false) => {
      if (!pos) return;
      const [lng, lat] = pos;
      const last = lastSyncRef.current;
      const moved = last ? haversine(last.lat, last.lng, lat, lng) : Infinity;
      const elapsed = last ? Date.now() - last.at : Infinity;
      if (!force && moved < 15 && elapsed < 10000) return;
      lastSyncRef.current = { at: Date.now(), lat, lng };
      try {
        const res = await fetch(
          `/api/quests?lat=${lat}&lng=${lng}&accuracyM=${accuracy}&speedKmh=${speed ?? ""}${firstSyncRef.current ? "&seed=1" : ""}`,
          { cache: "no-store" },
        );
        firstSyncRef.current = false;
        const json = (await res.json()) as { ok: boolean; quests?: QuestView[] };
        if (json.ok && json.quests) setQuests(json.quests);
      } catch {
        /* rede móvel instável: mantém o estado atual */
      }
    },
    [pos, accuracy, speed],
  );

  useEffect(() => {
    void sync(false);
  }, [sync]);

  useEffect(() => {
    if (!pos) return;
    const timer = window.setInterval(() => void sync(false), 10000);
    return () => window.clearInterval(timer);
  }, [sync, pos]);

  /* --------------------------- Missão mais próxima ativa --------------------------- */
  const nearest = useMemo(() => {
    const active = quests.filter((q) => q.state !== "completed" && q.distanceM !== null);
    return active.sort((a, b) => (a.distanceM ?? 0) - (b.distanceM ?? 0))[0] ?? null;
  }, [quests]);

  useEffect(() => {
    setNearId(nearest && (nearest.distanceM ?? 0) <= (nearest.radiusM * 2.5) ? nearest.id : null);
  }, [nearest]);

  const nearQuest = quests.find((q) => q.id === nearId) ?? null;

  const filtered = useMemo(() => {
    return quests.filter((q) => {
      if (!filters.showCompleted && q.state === "completed") return false;
      const cat = filters.categories[q.category];
      if (cat === false) return false;
      return true;
    });
  }, [quests, filters]);

  const emblemPoints: MapEmblem[] = useMemo(
    () =>
      layers.quests
        ? filtered
            .filter((q) => q.lat !== null && q.lng !== null)
            .map((q) => ({
              id: q.id,
              center: [q.lng as number, q.lat as number] as [number, number],
              emblemKey: q.emblem,
              accent: q.accent,
              highlighted: q.capturable || q.state === "unlocked",
              dimmed: q.state === "completed",
            }))
        : [],
    [filtered, layers.quests],
  );

  const selected = quests.find((q) => q.id === selectedId) ?? null;

  const routeLine: MapLine[] = useMemo(() => {
    if (!selected || selected.waypoints.length < 2 || !layers.quests) return [];
    return [
      {
        coords: selected.waypoints.sort((a, b) => a.order - b.order).map((w) => [w.lng, w.lat] as [number, number]),
        color: selected.accent,
        width: 5,
        dash: true,
      },
    ];
  }, [selected, layers.quests]);

  const checkpointEmblems: MapEmblem[] = useMemo(() => {
    if (!selected || selected.waypoints.length === 0) return [];
    return selected.waypoints.map((w, i) => ({
      id: 900000 + w.order,
      center: [w.lng, w.lat] as [number, number],
      emblemKey: "flag-checkered-flame",
      accent: w.order in selected.checkpointsHit ? "#d5ff45" : "#858b94",
      highlighted: selected.checkpointsHit.includes(w.order),
      dimmed: false,
    }));
  }, [selected]);

  const allPoints: MapEmblem[] = useMemo(() => [...emblemPoints, ...checkpointEmblems], [emblemPoints, checkpointEmblems]);

  /* --------------------------------- Ações --------------------------------- */
  async function act(action: "capture" | "start" | "pause" | "generate", questId?: number, paused?: boolean) {
    setBusy(true);
    try {
      const [lng, lat] = pos ?? [0, 0];
      const res = await fetch("/api/quests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, questId, paused, lat, lng, accuracyM: accuracy, speedKmh: speed }),
      });
      const json = (await res.json()) as {
        ok: boolean;
        error?: string;
        quests?: QuestView[];
        captured?: { xp: number; coins: number; quest: QuestView };
      };
      if (json.quests) setQuests(json.quests);
      if (!json.ok) {
        setToast(json.error ?? "Não foi possível concluir a ação.");
        window.setTimeout(() => setToast(null), 3600);
        return;
      }
      if (json.captured) {
        setCaptured({ quest: json.captured.quest, xp: json.captured.xp, coins: json.captured.coins });
      }
    } catch {
      setToast("Falha de conexão. Tente novamente.");
      window.setTimeout(() => setToast(null), 3200);
    } finally {
      setBusy(false);
    }
  }

  function recenter() {
    setLayers((p) => ({ ...p, position: true }));
    window.dispatchEvent(new CustomEvent("muv:recenter"));
  }

  return (
    <>
      <div className="fixed inset-x-0 top-0 bottom-0 mx-auto max-w-[480px] overflow-hidden">
        <MapCanvas
          className="absolute inset-0"
          emblems={allPoints}
          clusterEmblems
          circles={layers.territories ? territories : []}
          lines={[...(layers.territories ? territoryLines : []), ...(layers.segments ? segmentLines : []), ...routeLine]}
          userPos={layers.position ? pos : null}
          accuracyM={accuracy}
          follow
          autoFit={!pos && allPoints.length > 0}
          onEmblemClick={(id) => setSelectedId(id < 900000 ? id : selectedId)}
        />

        {/* Notificação discreta — não bloqueia a pedalada */}
        {nearId !== null ? (
          <button
            type="button"
            onClick={() => setSelectedId(nearId)}
            className="fade absolute inset-x-3 top-[64px] z-20 flex items-center gap-2.5 border border-line bg-ink/92 px-3 py-2.5 text-left backdrop-blur-md"
          >
            <EmblemIcon
              emblem={quests.find((q) => q.id === nearId)?.emblem}
              size={34}
            />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5">
                <span className="block truncate text-[12px] font-semibold">
                  {nearQuest?.name}
                </span>
                {nearQuest?.isSpecial ? (
                  <span className="shrink-0 border border-flame/50 px-1 py-[1px] text-[8px] font-display font-bold uppercase tracking-[0.1em] text-flame">
                    especial
                  </span>
                ) : null}
              </span>
              <span className="tabular block text-[10px] text-muted">
                {formatQuestDistance(nearQuest?.distanceM ?? null)} de você · {TIER_LABEL[nearQuest?.tier ?? "medio"]}
                {nearQuest?.timeLeftSec !== null && nearQuest?.timeLeftSec !== undefined
                  ? ` · ${formatCountdown(nearQuest.timeLeftSec)}`
                  : ""}
              </span>
            </span>
            <Icon.chevron className="size-3.5 shrink-0 text-muted" />
          </button>
        ) : null}

        {/* Status GPS */}
        <div className="pointer-events-none absolute left-3 top-[124px] z-10">
          <span
            className="inline-flex items-center gap-1.5 border bg-ink/90 px-2.5 py-1.5 text-[10px] font-display font-bold uppercase tracking-[0.14em]"
            style={{ borderColor: `${gps.accent}55`, color: gps.accent }}
          >
            <span className="size-1.5 rounded-full" style={{ background: gps.accent }} />
            {gpsState === "denied" ? "GPS off" : gps.label}
          </span>
        </div>

        {/* Controles flutuantes */}
        <div className="absolute right-3 top-[124px] z-10 flex flex-col gap-2">
          <button type="button" onClick={recenter} className="map-fab" aria-label="Centralizar minha localização">
            <Icon.pin className="size-[18px]" />
          </button>
          <button type="button" onClick={() => setFiltersOpen(true)} className="map-fab" aria-label="Filtros de missões">
            <Icon.layers className="size-[18px]" />
          </button>
          <button type="button" onClick={() => setListOpen(true)} className="map-fab" aria-label="Lista de objetivos">
            <Icon.feed className="size-[18px]" />
          </button>
        </div>

        {/* Resumo discreto */}
        <div className="pointer-events-none absolute left-3 top-[164px] z-10 flex flex-col gap-1.5">
          <span className="border border-line bg-ink/90 px-2 py-1 text-[9px] font-display font-bold uppercase tracking-[0.12em] text-lime">
            {quests.filter((q) => q.state !== "completed").length} missões ativas
          </span>
          <span className="border border-line bg-ink/90 px-2 py-1 text-[9px] font-display font-bold uppercase tracking-[0.12em] text-muted">
            {ownedTerritories}/{totalTerritories} territórios
          </span>
        </div>

        {toast ? (
          <div className="fade absolute inset-x-3 bottom-[calc(var(--nav-h)+env(safe-area-inset-bottom,0px)+96px)] z-30 border border-flame/40 bg-ink/95 px-3 py-2.5 text-[11px] text-flame">
            {toast}
          </div>
        ) : null}

        {/* Painel inferior arredondado da missão selecionada */}
        {selected ? (
          <div className="absolute inset-x-2 bottom-[calc(var(--nav-h)+env(safe-area-inset-bottom,0px)+10px)] z-30 rounded-[20px] border border-line bg-graphite/97 p-4 backdrop-blur-md">
            <div className="flex items-start gap-3">
              <EmblemIcon emblem={selected.emblem} size={52} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[9px] font-display font-bold uppercase tracking-[0.16em]" style={{ color: selected.accent }}>
                    {selected.kindLabel}
                  </span>
                  <span className="text-[9px] font-display font-bold uppercase tracking-[0.16em] text-muted">
                    {DIFFICULTY_META[selected.difficulty]?.label}
                  </span>
                  <span
                    className="border px-1.5 py-[1px] text-[8px] font-display font-bold uppercase tracking-[0.1em]"
                    style={{
                      borderColor: selected.tier === "longo" ? "rgba(255,212,59,0.5)" : selected.tier === "medio" ? "rgba(111,182,255,0.4)" : "var(--color-line)",
                      color: selected.tier === "longo" ? "#ffd43b" : selected.tier === "medio" ? "#6fb6ff" : "var(--color-muted)",
                    }}
                  >
                    {TIER_LABEL[selected.tier]}
                  </span>
                  {selected.isSpecial ? (
                    <span className="border border-flame/50 px-1.5 py-[1px] text-[8px] font-display font-bold uppercase tracking-[0.1em] text-flame">
                      boss especial
                    </span>
                  ) : null}
                </div>
                <p className="display-2 mt-1 truncate text-[15px]">{selected.name}</p>
                <p className="tabular mt-0.5 text-[11px] text-muted">
                  {formatQuestDistance(selected.distanceM)} · {questProgressLabel(selected)} · +{selected.xpReward} XP · +{selected.coinsReward} moedas
                </p>
                {selected.timeLeftSec !== null ? (
                  <p
                    className="metric mt-1.5 text-[11px] font-bold"
                    style={{ color: selected.timeLeftSec > 3600 ? "#d5ff45" : "#ff6a3d" }}
                  >
                    ⏱ {formatCountdown(selected.timeLeftSec)} restantes
                  </p>
                ) : null}
                {selected.roadName ? (
                  <p className="mt-1.5 truncate text-[10px] text-muted">
                    Via: {selected.roadName}
                    {selected.roadType ? ` · ${selected.roadType}` : ""}
                  </p>
                ) : null}
              </div>
              <button type="button" onClick={() => setSelectedId(null)} className="tap size-8 shrink-0" aria-label="Fechar painel">
                <Icon.close className="size-4" />
              </button>
            </div>

            <p className="mt-3 line-clamp-2 text-[12px] leading-relaxed text-muted">{selected.description}</p>

            {selected.kind === "boss" && selected.bossMaxHp > 0 ? (
              <div className="mt-3">
                <div className="flex justify-between text-[10px] font-display font-bold uppercase tracking-[0.12em] text-muted">
                  <span>HP do boss</span>
                  <span className="metric">{selected.hp ?? 0}/{selected.bossMaxHp}</span>
                </div>
                <div className="mt-1.5 h-[4px] w-full bg-graphite-2">
                  <div className="h-full bg-flame" style={{ width: `${((selected.hp ?? 0) / selected.bossMaxHp) * 100}%` }} />
                </div>
              </div>
            ) : null}

            {selected.kind === "route" && selected.waypoints.length > 0 ? (
              <div className="mt-3">
                <div className="flex justify-between text-[10px] font-display font-bold uppercase tracking-[0.12em] text-muted">
                  <span>Checkpoints validados</span>
                  <span className="metric">{selected.checkpointsHit.length}/{selected.waypoints.length}</span>
                </div>
                <div className="mt-1.5 h-[4px] w-full bg-graphite-2">
                  <div className="h-full bg-lime" style={{ width: `${(selected.checkpointsHit.length / selected.waypoints.length) * 100}%` }} />
                </div>
              </div>
            ) : null}

            {selected.safetyNote && !selected.verified ? (
              <p className="mt-3 border border-line bg-ink/60 px-2.5 py-2 text-[10px] leading-relaxed text-muted">
                ⚠ {selected.safetyNote}
              </p>
            ) : null}

            {selected.blockedReason ? (
              <p className="mt-3 border border-line bg-ink/60 px-2.5 py-2 text-[11px] leading-relaxed text-muted">
                {selected.blockedReason}
              </p>
            ) : null}

            <div className="mt-3 flex gap-2">
              {selected.state === "completed" ? (
                <span className="btn btn-dark flex-1 cursor-default text-lime">Concluída</span>
              ) : selected.capturable ? (
                <button type="button" disabled={busy} onClick={() => void act("capture", selected.id)} className="btn btn-primary flex-1">
                  <Icon.bolt className="size-4" />
                  Capturar recompensa
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void act("start", selected.id)}
                    className="btn btn-dark flex-1"
                  >
                    {selected.state === "in_progress" ? "Em andamento" : "Aceitar missão"}
                  </button>
                  <Link href="/app/record" className="btn btn-primary flex-1">
                    <Icon.record className="size-4" />
                    Gravar
                  </Link>
                </>
              )}
            </div>

            {selected.state === "in_progress" ? (
              <button
                type="button"
                onClick={() => void act("pause", selected.id, !selected.paused)}
                className="mt-2 w-full text-[10px] font-display font-bold uppercase tracking-[0.14em] text-muted"
              >
                {selected.paused ? "Retomar missão" : "Pausar missão"}
              </button>
            ) : null}
          </div>
        ) : (
          <Link
            href="/app/record"
            className="btn btn-primary absolute inset-x-2 bottom-[calc(var(--nav-h)+env(safe-area-inset-bottom,0px)+10px)] z-30"
          >
            <Icon.record className="size-4" />
            Iniciar atividade
          </Link>
        )}
      </div>

      {/* Filtros */}
      <BottomSheet open={filtersOpen} onClose={() => setFiltersOpen(false)} eyebrow="Camadas" title="Filtros do mapa">
        <p className="eyebrow mb-2">Tipos de objetivo</p>
        <ul className="grid grid-cols-1 divide-y divide-line border-y border-line">
          {CATEGORY_KEYS.map((key) => {
            const meta = CATEGORY_META[key];
            const on = filters.categories[key] !== false;
            return (
              <li key={key}>
                <button
                  type="button"
                  onClick={() => setFilters((p) => ({ ...p, categories: { ...p.categories, [key]: !on } }))}
                  className="flex w-full items-center gap-3 py-3 text-left"
                >
                  <EmblemIcon emblem={meta.emblem} size={34} ring={on} />
                  <span className="min-w-0 flex-1 text-[13px] font-medium">{meta.label}</span>
                  <span className={`metric text-[11px] font-bold ${on ? "text-lime" : "text-muted"}`}>{on ? "ON" : "OFF"}</span>
                </button>
              </li>
            );
          })}
        </ul>

        <p className="eyebrow mb-2 mt-5">Camadas</p>
        <ul className="divide-y divide-line border-y border-line">
          {([
            ["quests", "Missões e bosses", "Objetivos interativos do mapa"],
            ["territories", "Territórios", "Áreas que você pode dominar"],
            ["segments", "Segmentos", "Trechos cronometrados"],
            ["position", "Minha posição", "GPS em tempo real"],
          ] as [keyof typeof layers, string, string][]).map(([key, label, desc]) => (
            <li key={key}>
              <button
                type="button"
                onClick={() => setLayers((p) => ({ ...p, [key]: !p[key] }))}
                className="flex w-full items-center gap-3 py-3 text-left"
              >
                <span className={`grid size-5 shrink-0 place-items-center border ${layers[key] ? "border-lime bg-lime text-ink" : "border-line"}`}>
                  {layers[key] ? <Icon.check className="size-3" /> : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-medium">{label}</span>
                  <span className="block text-[11px] text-muted">{desc}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>

        <label className="mt-4 flex items-center gap-2.5 text-[13px]">
          <input
            type="checkbox"
            checked={filters.showCompleted}
            onChange={(e) => setFilters((p) => ({ ...p, showCompleted: e.target.checked }))}
            className="size-5"
          />
          Mostrar missões concluídas
        </label>

        <button type="button" disabled={busy} onClick={() => void act("generate")} className="btn btn-dark mt-4 w-full">
          <Icon.bolt className="size-4" />
          Gerar missões pela minha região
        </button>
        <p className="mt-2 text-[10px] leading-relaxed text-muted">
          Objetivos posicionados sobre vias públicas reais (OpenStreetMap). Recompensas crescem com a distância: curto, médio
          e longo alcance. Bosses especiais só aparecem após você concluir desafios.
        </p>
      </BottomSheet>

      {/* Lista de objetivos */}
      <BottomSheet open={listOpen} onClose={() => setListOpen(false)} eyebrow="Exploração" title="Objetivos no território">
        <ul className="divide-y divide-line border-y border-line">
          {filtered
            .slice()
            .sort((a, b) => (a.distanceM ?? 999999) - (b.distanceM ?? 999999))
            .map((q) => (
              <li key={q.id}>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedId(q.id);
                    setListOpen(false);
                  }}
                  className="flex w-full items-center gap-3 py-3 text-left"
                >
                  <EmblemIcon emblem={q.emblem} size={40} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold">{q.name}</span>
                    <span className="tabular block truncate text-[11px] text-muted">
                      {formatQuestDistance(q.distanceM)} · {questProgressLabel(q)} · +{q.xpReward} XP
                    </span>
                  </span>
                  <span
                    className="metric shrink-0 text-[9px] font-bold uppercase tracking-[0.12em]"
                    style={{ color: q.state === "completed" ? "#858b94" : q.accent }}
                  >
                    {QUEST_STAT_LABEL[q.state]}
                  </span>
                </button>
              </li>
            ))}
          {filtered.length === 0 ? <li className="py-5 text-[13px] text-muted">Nenhum objetivo visível com estes filtros.</li> : null}
        </ul>
      </BottomSheet>

      {captured ? (
        <CaptureReveal quest={captured.quest} xp={captured.xp} coins={captured.coins} onClose={() => setCaptured(null)} />
      ) : null}
    </>
  );
}
