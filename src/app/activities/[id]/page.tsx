import Link from "next/link";
import { notFound } from "next/navigation";
import { getActivity, simplify } from "@/lib/queries";
import { getSport } from "@/lib/sports";
import { fmtDate, fmtKm, fmtPace, fmtSpeed, fmtTime } from "@/lib/format";
import { splits, elevationProfile } from "@/lib/analysis";
import Icon from "@/components/Icon";
import PageHead from "@/components/PageHead";
import ActivityReplayMap from "@/components/ActivityReplayMap";
import PhotoStrip from "@/components/PhotoStrip";
import { KudosButton, ShareButton, CommentForm } from "@/components/Social";

export const dynamic = "force-dynamic";

export default async function ActivityPage({ params }: { params: Promise<{ id: string }> }) {
  const a = await getActivity(Number((await params).id));
  if (!a) notFound();
  const s = getSport(a.sport);
  const photoList = a.photos.map((p) => ({ id: p.id, lat: p.lat, lng: p.lng, kmMark: p.kmMark, takenAt: p.takenAt?.toISOString() ?? null }));
  const pts = simplify(a.points).map((p) => ({ lat: p.lat, lng: p.lng }));
  const sp = s.display !== "time" ? splits(a.points) : [];
  const prof = elevationProfile(a.points);
  const speedMode = s.display === "speed";
  const stats: [string, string][] = [
    ["Distância", `${fmtKm(a.distanceM)} km`],
    ["Tempo em movimento", fmtTime(a.movingSec)],
    ["Tempo total", fmtTime(a.elapsedSec)],
    speedMode ? ["Velocidade média", `${fmtSpeed(a.avgSpeed)} km/h`] : ["Pace médio", `${fmtPace(a.avgSpeed)} /km`],
    speedMode ? ["Velocidade máxima", `${fmtSpeed(a.maxSpeed)} km/h`] : ["Melhor pace", `${fmtPace(a.maxSpeed)} /km`],
    ["Elevação acumulada", `${Math.round(a.elevGainM)} m`],
    ["Altitude máx/mín", a.maxAltM != null ? `${Math.round(a.maxAltM)} / ${Math.round(a.minAltM ?? 0)} m` : "--"],
    ["Calorias", `${a.calories} kcal`],
  ];
  const extras = (s.extraFields ?? []).filter((f) => a.extra?.[f.key] !== undefined && a.extra[f.key] !== "" && a.extra[f.key] !== 0);
  let svgPath = "";
  if (prof.length > 1) {
    const maxD = prof[prof.length - 1].d || 1, minA = Math.min(...prof.map((p) => p.alt)), maxA = Math.max(...prof.map((p) => p.alt)), rng = Math.max(10, maxA - minA);
    svgPath = `M0,100 ` + prof.map((p) => `L${((p.d / maxD) * 400).toFixed(1)},${(100 - ((p.alt - minA) / rng) * 90).toFixed(1)}`).join(" ") + ` L400,100 Z`;
  }
  const best = sp.filter((x) => !x.partial).reduce((m, x) => Math.min(m, x.sec), Infinity);

  return (
    <div className="px-4 pb-nav">
      <PageHead title="Atividade" back="/" />
      <header className="pt-5 pb-5 flex flex-col gap-4">
        <div className="max-w-3xl">
          <div className="flex items-center gap-3 text-sm text-mute">
            <span className="w-9 h-9 border flex items-center justify-center text-bone"><Icon name={s.key} size={20} /></span>
            <span>{s.label} · {fmtDate(a.startedAt)}</span>
            {a.status === "draft" && <span className="eyebrow flex items-center gap-1"><Icon name="lock" size={12} />Privada</span>}
          </div>
          <h1 className="display text-[34px]  mt-5">{a.title}</h1>
          {a.caption && <p className="mt-5 text-bone/75 text-[15px] leading-relaxed whitespace-pre-line">{a.caption}</p>}
        </div>
        <div className="flex gap-2 shrink-0">
          <Link href={`/activities/${a.id}/edit`} className="btn btn-ghost btn-sm"><Icon name="edit" size={15} />Editar</Link>
          <Link href={`/compare?a=${a.id}`} className="btn btn-ghost btn-sm"><Icon name="compare" size={15} />Comparar</Link>
        </div>
      </header>

      {a.integrity === "suspect" && (
        <div role="status" className="mb-5 border border-[#5C3A1E] bg-[#2A1A12] p-4 text-[13px] leading-relaxed text-[#F5D0B5]">
          <div className="font-semibold text-bone">Atividade não contabilizada</div>
          <p className="mt-1">Detectamos velocidade incompatível com a modalidade escolhida (possível uso de veículo ou falha de GPS). Por isso, este percurso não contará para XP, missões, bosses, recompensas e rankings. A atividade continua salva no seu histórico.</p>
          {a.integrityReasons.length > 0 && <ul className="mt-2 list-disc pl-4 text-[12px] text-[#D9B79E]">{a.integrityReasons.map((r) => <li key={r}>{r}</li>)}</ul>}
        </div>
      )}
      <div className="grid grid-cols-2  gap-px bg-line border-y border-line">
        {stats.map(([k, v], i) => (
          <div key={k} className="bg-ink py-5  px-4 ">
            <div className="eyebrow !text-[10px]">{k}</div>
            <div className={`num mt-2 ${i < 4 ? "text-3xl " : "text-xl  text-bone/85"}`}>{v}</div>
          </div>
        ))}
      </div>

      <div className="-mx-4  mt-8 space-y-px">
        {a.photos.length > 0 && <PhotoStrip ids={a.photos.map((p) => p.id)} large meta={Object.fromEntries(photoList.map((p) => [p.id, p]))} date={a.startedAt.toISOString()} />}
        {pts.length > 1 && <ActivityReplayMap points={pts.map((p) => [p.lat, p.lng] as [number, number])} photos={photoList} date={a.startedAt.toISOString()} className="h-[380px]" />}
      </div>

      <div className="flex flex-wrap items-center gap-2 py-3 border-b border-line">
        <KudosButton id={a.id} initial={a.kudos} />
        <ShareButton id={a.id} title={a.title} text={`${a.title} — ${fmtKm(a.distanceM)} km em ${fmtTime(a.movingSec)} · MUV`} />
        {extras.length > 0 && <div className="ml-auto flex flex-wrap gap-x-6 gap-y-1 text-sm">{extras.map((f) => <span key={f.key}><span className="text-mute">{f.label}</span> <span className="text-bone">{a.extra[f.key]}{f.unit ? ` ${f.unit}` : ""}</span></span>)}</div>}
      </div>

      <div className="grid  gap-x-14">
        {svgPath && (
          <section className="py-12 border-b border-line ">
            <div className="eyebrow mb-6">Altimetria</div>
            <svg viewBox="0 0 400 100" preserveAspectRatio="none" className="w-full h-44"><path d={svgPath} fill="rgba(213,255,69,.10)" stroke="#D5FF45" strokeWidth="1.2" vectorEffect="non-scaling-stroke" /></svg>
            <div className="flex justify-between text-xs text-mute mt-2 num"><span>0 km</span><span>{fmtKm(prof[prof.length - 1].d, 1)} km</span></div>
          </section>
        )}
        {sp.length > 0 && (
          <section className="py-12">
            <div className="eyebrow mb-6">Parciais por km</div>
            <table className="w-full text-sm">
              <thead><tr className="text-left text-mute text-[11px] uppercase tracking-widest"><th className="pb-3 font-medium">Km</th><th className="pb-3 font-medium">{speedMode ? "Vel." : "Pace"}</th><th className="w-1/2"></th><th className="pb-3 text-right font-medium">Elev.</th></tr></thead>
              <tbody>
                {sp.map((x) => {
                  const dist = x.partial ?? 1000; const v = x.sec > 0 ? dist / x.sec : 0; const w = best && isFinite(best) ? Math.min(100, (best / (x.sec * 1000 / dist)) * 100) : 50;
                  return (
                    <tr key={x.km} className="border-t border-line">
                      <td className="py-2.5 num text-mute">{x.partial ? (x.partial / 1000).toFixed(2) : x.km}</td>
                      <td className="num">{speedMode ? `${fmtSpeed(v)}` : fmtPace(v)}</td>
                      <td className="pr-4"><div className={`h-1.5 ${x.sec === best ? "bg-lime" : "bg-bone/30"}`} style={{ width: `${w}%` }} /></td>
                      <td className="text-right num text-mute">{Math.round(x.elev)} m</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        )}
      </div>

      <section id="comentarios" className="py-12 border-t border-line max-w-3xl">
        <div className="eyebrow mb-6">Comentários · {a.comments.length}</div>
        <div className="space-y-5 mb-8">
          {a.comments.map((c) => (
            <div key={c.id} className="flex gap-4">
              <span className="w-9 h-9 shrink-0 bg-graphite border flex items-center justify-center text-sm font-semibold">{c.author.slice(0, 1).toUpperCase()}</span>
              <div><div className="text-sm"><span className="font-medium">{c.author}</span> <span className="text-mute text-xs ml-2">{fmtDate(c.createdAt)}</span></div><p className="text-bone/80 mt-1">{c.body}</p></div>
            </div>
          ))}
        </div>
        <CommentForm id={a.id} />
      </section>
    </div>
  );
}
