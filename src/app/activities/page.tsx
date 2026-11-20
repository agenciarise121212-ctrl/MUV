import Link from "next/link";
import { listActivities } from "@/lib/queries";
import { GROUPS, getSport } from "@/lib/sports";
import { fmtDate, fmtKm, fmtPace, fmtSpeed, fmtTime } from "@/lib/format";
import PageHead from "@/components/PageHead";
import Icon from "@/components/Icon";

export const dynamic = "force-dynamic";

export default async function ActivitiesPage({ searchParams }: { searchParams: Promise<{ g?: string }> }) {
  const g = (await searchParams).g;
  const all = await listActivities();
  const list = g ? all.filter((a) => getSport(a.sport).group === g) : all;
  const tabs = [{ key: undefined as string | undefined, label: "Todas" }, ...GROUPS.filter((x) => x.key !== "outros")];
  return (
    <div className="px-4 pb-nav">
      <PageHead eyebrow="Histórico" title="Atividades" back="/profile?tab=atividades">
        <nav className="flex gap-6 overflow-x-auto">
          {tabs.map((x) => { const on = g === x.key; return (
            <Link key={x.label} href={x.key ? `/activities?g=${x.key}` : "/activities"} className={`text-sm pb-2 border-b-2 transition-colors whitespace-nowrap ${on ? "border-lime text-bone" : "border-transparent text-mute hover:text-bone"}`}>{x.label}</Link>); })}
        </nav>
      </PageHead>
      {list.length === 0 && <div className="py-16 text-center text-mute">Nenhuma atividade ainda. <Link className="text-lime link-u" href="/record">Gravar agora</Link></div>}
      <div className="border-t border-line">
        {list.map((a) => {
          const s = getSport(a.sport);
          return (
            <Link key={a.id} href={`/activities/${a.id}`} className="group grid grid-cols-[56px_1fr_auto]  items-center gap-4  py-4 border-b border-line hover:bg-graphite transition-colors ">
              {a.photos[0] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`/api/photos/${a.photos[0].id}`} alt="" className="w-14 h-14   object-cover" />
              ) : <div className="w-14 h-14   border flex items-center justify-center text-mute group-hover:text-lime transition-colors"><Icon name={s.key} size={26} /></div>}
              <div className="min-w-0">
                <div className="font-medium truncate flex items-center gap-2">{a.title}{a.status === "draft" && <Icon name="lock" size={13} className="text-mute shrink-0" />}</div>
                <div className="text-xs text-mute mt-1 flex items-center gap-2">{s.label} · {fmtDate(a.startedAt)}{a.photos.length > 0 && <span className="inline-flex items-center gap-1"><Icon name="image" size={12} />{a.photos.length}</span>}</div>
              </div>
              <div className="text-right "><div className="num text-lg">{fmtKm(a.distanceM)}<span className="text-xs text-mute ml-1 font-sans">km</span></div><div className="text-xs text-mute ">{fmtTime(a.movingSec)}</div></div>
              <div className="hidden  num text-lg">{fmtTime(a.movingSec)}</div>
              <div className="hidden  num text-lg">{s.display === "speed" ? fmtSpeed(a.avgSpeed) : fmtPace(a.avgSpeed)}<span className="text-xs text-mute ml-1 font-sans">{s.display === "speed" ? "km/h" : "/km"}</span></div>
              <Icon name="arrow" size={16} className="hidden  text-mute opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 group-hover:text-lime transition-all" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
