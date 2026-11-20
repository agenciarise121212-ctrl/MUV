"use client";
import { useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { SPORTS, getSport } from "@/lib/sports";
import { fmtKm, fmtTime, fmtPace, fmtSpeed } from "@/lib/format";
import Lightbox from "@/components/Lightbox";
import Icon from "@/components/Icon";
import PageHead from "@/components/PageHead";
import { fetchJson } from "@/lib/http";
import { compressImage, MAX_PHOTOS } from "@/lib/image";

const RouteMap = dynamic(() => import("@/components/RouteMap"), { ssr: false });

type Act = { id: number; sport: string; title: string; caption: string; status: string; extra: Record<string, string | number>; distanceM: number; movingSec: number; elevGainM: number; avgSpeed: number; calories: number; integrity: string; integrityReasons: string[] };

export default function Editor({ activity, points, photos: initial, isNew }: { activity: Act; points: { lat: number; lng: number }[]; photos: number[]; isNew: boolean }) {
  const router = useRouter();
  const [title, setTitle] = useState(activity.title);
  const [caption, setCaption] = useState(activity.caption);
  const [sportKey, setSportKey] = useState(activity.sport);
  const [extra, setExtra] = useState<Record<string, string | number>>(activity.extra ?? {});
  const [photos, setPhotos] = useState<number[]>(initial);
  const [uploading, setUploading] = useState(0);
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<number | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const gallery = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const sport = getSport(sportKey);
  const group = sport.group;

  async function addFiles(files: FileList | null) {
    if (!files?.length) return;
    const room = MAX_PHOTOS - photos.length - uploading;
    if (room <= 0) { alert(`Limite de ${MAX_PHOTOS} fotos por atividade.`); return; }
    const all = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (all.length > room) alert(`Só cabem mais ${room} foto(s). As demais foram ignoradas.`);
    const list = all.slice(0, room);
    setUploading((n) => n + list.length);
    for (const f of list) {
      try {
        const data = await compressImage(f);
        const r = await fetchJson<{ id: number }>(`/api/activities/${activity.id}/photos`, { json: { data } });
        if (r.ok) setPhotos((p) => [...p, r.data.id]);
        else alert(`Falha ao enviar uma das fotos: ${r.error}`);
      } catch { alert("Não foi possível processar uma das imagens."); }
      setUploading((n) => n - 1);
    }
  }

  async function remove(id: number) {
    if (!confirm("Remover esta foto?")) return;
    await fetch(`/api/photos/${id}`, { method: "DELETE" });
    setPhotos((p) => p.filter((x) => x !== id));
  }

  async function saveOrder(next: number[]) {
    setPhotos(next);
    await fetch(`/api/activities/${activity.id}/photos`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: next }) });
  }
  function move(i: number, d: number) {
    const j = i + d; if (j < 0 || j >= photos.length) return;
    const n = [...photos]; [n[i], n[j]] = [n[j], n[i]]; saveOrder(n);
  }
  function dropAt(i: number) {
    if (dragIdx == null || dragIdx === i) return;
    const n = [...photos]; const [m] = n.splice(dragIdx, 1); n.splice(i, 0, m); setDragIdx(null); saveOrder(n);
  }

  async function save(status: "published" | "draft") {
    setBusy(true);
    const r = await fetchJson(`/api/activities/${activity.id}`, { method: "PATCH", json: { title, caption, sport: sportKey, extra, status } });
    if (!r.ok) { alert(r.error); setBusy(false); return; }
    router.push(`/activities/${activity.id}`);
    router.refresh();
  }

  async function del() {
    if (!confirm("Excluir esta atividade permanentemente?")) return;
    await fetch(`/api/activities/${activity.id}`, { method: "DELETE" });
    router.push("/activities"); router.refresh();
  }

  return (
    <div className="px-4 pb-nav space-y-5">
      <PageHead title={isNew ? "Salvar atividade" : "Editar"} back={`/activities/${activity.id}`} />
      <div><div className="eyebrow">{isNew ? "Atividade concluída" : "Edição"}</div><h1 className="display text-[34px]  mt-3">{isNew ? "Boa. Agora conte como foi." : "Editar atividade"}</h1></div>
      {activity.integrity === "suspect" && (<div role="status" className="border border-[#5C3A1E] bg-[#2A1A12] p-4 text-[13px] leading-relaxed text-[#F5D0B5]">
          <div className="font-semibold text-bone">Atividade não contabilizada</div>
          <p className="mt-1">Detectamos velocidade incompatível com a modalidade escolhida (possível uso de veículo ou falha de GPS). Por isso, este percurso não contará para XP, missões, bosses, recompensas e rankings. A atividade continua salva no seu histórico.</p>
          {activity.integrityReasons.length > 0 && <ul className="mt-2 list-disc pl-4 text-[12px] text-[#D9B79E]">{activity.integrityReasons.map((r) => <li key={r}>{r}</li>)}</ul>}
        </div>)}
      <div className="panel overflow-hidden">
        {points.length > 1 && <RouteMap points={points} interactive={false} className="h-48" />}
        <div className="grid grid-cols-4 text-center py-5 text-sm divide-x divide-line">
          <div><b className="num text-2xl font-bold">{fmtKm(activity.distanceM)}</b><div className="text-mute text-xs">km</div></div>
          <div><b className="num text-2xl font-bold">{fmtTime(activity.movingSec)}</b><div className="text-mute text-xs">tempo</div></div>
          <div><b className="num text-2xl font-bold">{sport.display === "speed" ? fmtSpeed(activity.avgSpeed) : fmtPace(activity.avgSpeed)}</b><div className="text-mute text-xs">{sport.display === "speed" ? "km/h" : "/km"}</div></div>
          <div><b className="num text-2xl font-bold">{Math.round(activity.elevGainM)}</b><div className="text-mute text-xs">m elev.</div></div>
        </div>
      </div>

      <div className="panel p-5  space-y-5">
        <label className="block text-xs text-mute">Título
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1.5 field font-normal" />
        </label>
        <label className="block text-xs text-mute">Legenda
          <textarea value={caption} onChange={(e) => setCaption(e.target.value)} rows={3} placeholder="Como foi? Conte sobre o trajeto, a paisagem, a sensação…" className="mt-1.5 field font-normal" />
        </label>
        <label className="block text-xs text-mute">Modalidade
          <select value={sportKey} onChange={(e) => setSportKey(e.target.value)} className="mt-1.5 field font-normal">
            {SPORTS.filter((s) => s.enabled && s.group === group).map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </label>
        {sport.extraFields?.length ? (
          <div className="grid grid-cols-2 gap-3">
            {sport.extraFields.map((f) => (
              <label key={f.key} className="block text-xs text-mute">{f.label}{f.unit && ` (${f.unit})`}
                {f.type === "select" ? (
                  <select value={String(extra[f.key] ?? "")} onChange={(e) => setExtra({ ...extra, [f.key]: e.target.value })} className="mt-1.5 field font-normal">
                    <option value="">—</option>{f.options!.map((o) => <option key={o}>{o}</option>)}
                  </select>
                ) : (
                  <input type={f.type} value={String(extra[f.key] ?? "")} onChange={(e) => setExtra({ ...extra, [f.key]: f.type === "number" ? Number(e.target.value) : e.target.value })} className="mt-1.5 field font-normal" />
                )}
              </label>
            ))}
          </div>
        ) : null}
      </div>

      <div className="panel p-5 ">
        <div className="flex items-center justify-between mb-3">
          <h2 className="eyebrow">Fotos <span className="num text-bone ml-1">{photos.length}/{MAX_PHOTOS}</span></h2>
          <div className="flex gap-2">
            <button onClick={() => gallery.current?.click()} disabled={photos.length >= MAX_PHOTOS} className="btn btn-ghost btn-sm"><Icon name="image" size={15} />Galeria</button>
            <button onClick={() => camera.current?.click()} disabled={photos.length >= MAX_PHOTOS} className="btn btn-ghost btn-sm"><Icon name="camera" size={15} />Câmera</button>
          </div>
          <input ref={gallery} type="file" accept="image/*" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
          <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
        </div>
        {photos.length === 0 && !uploading && (
          <button onClick={() => gallery.current?.click()} className="w-full border border-dashed py-12 hover:border-lime hover:text-bone transition-colors text-mute text-sm">Adicione fotos do seu treino</button>
        )}
        <div className="grid grid-cols-3 gap-2">
          {photos.map((id, i) => (
            <div key={id} draggable onDragStart={() => setDragIdx(i)} onDragOver={(e) => e.preventDefault()} onDrop={() => dropAt(i)}
              className={`relative aspect-square overflow-hidden bg-ink ${dragIdx === i ? "opacity-50" : ""}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/photos/${id}`} alt="" className="w-full h-full object-cover cursor-zoom-in" onClick={() => setView(i)} />
              {i === 0 && <span className="absolute top-1.5 left-1.5 bg-lime text-ink text-[10px] font-semibold tracking-widest px-1.5 py-0.5">CAPA</span>}
              <button onClick={() => remove(id)} aria-label="Remover" className="absolute top-1.5 right-1.5 bg-ink/85 text-bone w-7 h-7 flex items-center justify-center hover:bg-bone hover:text-ink transition-colors"><Icon name="close" size={13} /></button>
              <div className="absolute bottom-1 inset-x-1 flex justify-between">
                <button onClick={() => move(i, -1)} disabled={i === 0} className="bg-ink/85 text-bone w-7 h-7 flex items-center justify-center disabled:opacity-30"><Icon name="arrow" size={12} className="rotate-180" /></button>
                <button onClick={() => move(i, 1)} disabled={i === photos.length - 1} className="bg-ink/85 text-bone w-7 h-7 flex items-center justify-center disabled:opacity-30"><Icon name="arrow" size={12} /></button>
              </div>
            </div>
          ))}
          {Array.from({ length: uploading }).map((_, i) => <div key={`u${i}`} className="aspect-square bg-line animate-pulse flex items-center justify-center text-xs text-mute">Enviando…</div>)}
        </div>
        {photos.length > 1 && <p className="text-xs text-mute mt-2">Arraste ou use as setas para reordenar. A primeira foto é a capa.</p>}
      </div>

      <div className="flex flex-col  gap-2">
        <button disabled={busy || uploading > 0} onClick={() => save("published")} className="btn btn-lime flex-1 !h-12">{activity.status === "published" ? "Salvar alterações" : "Publicar atividade"}</button>
        <button disabled={busy || uploading > 0} onClick={() => save("draft")} className="btn btn-ghost  !h-12">Salvar como privada</button>
      </div>
      <button onClick={del} className="text-[13px] text-mute hover:text-bone link-u">Excluir atividade</button>
      {view != null && <Lightbox ids={photos} index={view} onClose={() => setView(null)} />}
    </div>
  );
}
