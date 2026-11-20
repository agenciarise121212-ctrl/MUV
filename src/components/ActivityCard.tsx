import Link from "next/link";
import { getSport } from "@/lib/sports";
import { fmtDate, fmtKm, fmtPace, fmtSpeed, fmtTime } from "@/lib/format";
import MapView from "./MapView";
import PhotoStrip from "./PhotoStrip";
import Icon from "./Icon";
import { KudosButton, ShareButton } from "./Social";

export type CardData = {
  id: number; sport: string; title: string; caption: string; status: string; startedAt: Date; distanceM: number; movingSec: number;
  avgSpeed: number; elevGainM: number; kudos: number; integrity?: string; points: { lat: number; lng: number }[]; photos: number[]; commentCount: number;
};

export default function ActivityCard({ a }: { a: CardData }) {
  const s = getSport(a.sport);
  const stats: [string, string, string][] = [
    ["Distância", fmtKm(a.distanceM), "km"],
    s.display === "speed" ? ["Vel. média", fmtSpeed(a.avgSpeed), "km/h"] : ["Pace", fmtPace(a.avgSpeed), "/km"],
    ["Tempo", fmtTime(a.movingSec), ""],
  ];
  if (a.elevGainM > 0) stats.push(["Elevação", String(Math.round(a.elevGainM)), "m"]);
  return (
    <article className="bg-graphite border-y border-line group/card">
      <div className="p-5 ">
        <div className="flex items-center gap-3 text-xs text-mute">
          <span className="w-9 h-9 flex items-center justify-center border text-bone"><Icon name={s.key} size={20} /></span>
          <span className="flex-1 leading-tight"><span className="block text-bone/90 font-medium">{s.label}</span>{fmtDate(a.startedAt)}</span>
          {a.status === "draft" && <span className="flex items-center gap-1 eyebrow"><Icon name="lock" size={12} />Privada</span>}
          {a.integrity === "suspect" && <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 border border-[#5C3A1E] text-[#F5D0B5]">Não contabilizada</span>}
        </div>
        <Link href={`/activities/${a.id}`} className="block mt-4 text-xl  font-semibold tracking-tight leading-snug hover:text-lime transition-colors">{a.title}</Link>
        {a.caption && <p className="text-[15px] text-bone/70 mt-2 line-clamp-3 whitespace-pre-line leading-relaxed">{a.caption}</p>}
        <div className="flex gap-7  mt-5">
          {stats.map(([l, v, u], i) => (
            <div key={l} className={i === 3 ? "hidden " : ""}>
              <div className="eyebrow !text-[10px] !tracking-[.18em]">{l}</div>
              <div className="num text-2xl mt-1">{v}<span className="text-xs text-mute font-sans font-medium ml-1 tracking-normal">{u}</span></div>
            </div>
          ))}
        </div>
      </div>
      {a.points.length > 1 && <Link href={`/activities/${a.id}`} className="block h-56  overflow-hidden"><MapView points={a.points} interactive={false} className="h-full pointer-events-none" /></Link>}
      {a.photos.length > 0 && <div className="border-t border-line"><PhotoStrip ids={a.photos} /></div>}
      <div className="flex items-center gap-1 px-3 border-t">
        <KudosButton id={a.id} initial={a.kudos} />
        <Link href={`/activities/${a.id}#comentarios`} className="inline-flex items-center gap-2 h-10 px-3 text-[13px] font-medium text-mute hover:text-bone transition-colors"><Icon name="chat" size={18} /><span className="num">{a.commentCount}</span></Link>
        <span className="ml-auto"><ShareButton id={a.id} title={a.title} text={`${a.title} — ${fmtKm(a.distanceM)} km em ${fmtTime(a.movingSec)} · MUV`} /></span>
      </div>
    </article>
  );
}
