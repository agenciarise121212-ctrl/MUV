import Link from "next/link";
import Image from "next/image";
import { wallet } from "@/lib/rpg";
import { listActivities, simplify } from "@/lib/queries";
import { challenges, level } from "@/lib/gamification";
import { fmtKm, fmtTime } from "@/lib/format";
import { getSport } from "@/lib/sports";
import ActivityCard from "@/components/ActivityCard";
import Icon from "@/components/Icon";
import Logo from "@/components/Logo";
import hero from "../../public/img/trail.jpg";

export const dynamic = "force-dynamic";

const QUICK = [
  { key: "run", label: "Corrida" },
  { key: "walk", label: "Caminhada" },
  { key: "road_bike", label: "Ciclismo" },
];

export default async function Home() {
  const all = await listActivities();
  const feed = all.filter((a) => a.status === "published").slice(0, 10);
  const week = all.filter((a) => new Date(a.startedAt).getTime() > Date.now() - 7 * 864e5);
  const wal = await wallet();
  const lv = level(all, wal.xp);
  const missions = challenges(all).filter((c) => c.progress < c.goal).sort((a, b) => b.progress / b.goal - a.progress / a.goal).slice(0, 2);
  const h = new Date().getHours();
  const hello = h < 5 ? "Boa noite" : h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - 6 + i); const km = all.filter((a) => { const t = new Date(a.startedAt); return t >= d && t.getTime() < d.getTime() + 864e5; }).reduce((s, a) => s + a.distanceM, 0); return { d, km }; });
  const maxDay = Math.max(1, ...days.map((x) => x.km));

  return (
    <div className="pb-nav">
      {/* topo */}
      <header className="sticky top-0 z-[500] bg-ink/94 backdrop-blur-md px-4 flex items-center justify-between border-b border-line" style={{ paddingTop: "env(safe-area-inset-top)", height: "calc(3.25rem + env(safe-area-inset-top))" }}>
        <Logo className="h-[17px] text-bone" />
        <Link href="/profile" className="tap flex items-center gap-2 h-9 pl-3 pr-1 border border-line rounded-full text-[12px]">
          <span className="text-mute">Nível</span><span className="num">{lv.level}</span>
          <span className="w-7 h-7 rounded-full bg-lime text-ink flex items-center justify-center text-[12px] font-bold">A</span>
        </Link>
      </header>

      <div className="px-4">
        <div className="pt-5">
          <p className="text-mute text-sm">{hello}, atleta</p>
          <h1 className="display text-[40px] mt-1">Bora se<br />mover hoje?</h1>
        </div>

        {/* Início rápido */}
        <div className="grid grid-cols-3 gap-2 mt-5">
          {QUICK.map((q, i) => (
            <Link key={q.key} href={`/record?sport=${q.key}`} className={`tap h-[92px] flex flex-col justify-between p-3 border ${i === 0 ? "bg-lime text-ink border-lime" : "bg-graphite border-line"}`}>
              <Icon name={q.key} size={26} />
              <span className="text-[13px] font-semibold flex items-center justify-between">{q.label}<Icon name="arrow" size={14} /></span>
            </Link>
          ))}
        </div>

        {/* Semana */}
        <section className="mt-6 panel p-4">
          <div className="flex items-center justify-between"><span className="eyebrow">Esta semana</span><Link href="/activities" className="tap text-[12px] text-mute flex items-center gap-1">Histórico<Icon name="chevron" size={14} /></Link></div>
          <div className="flex items-end justify-between mt-3">
            <div className="flex gap-6">
              <div><div className="num text-[34px] leading-none">{fmtKm(week.reduce((s, a) => s + a.distanceM, 0), 1)}</div><div className="text-[11px] text-mute mt-1">km</div></div>
              <div><div className="num text-[34px] leading-none">{week.length}</div><div className="text-[11px] text-mute mt-1">atividades</div></div>
              <div><div className="num text-[34px] leading-none">{fmtTime(week.reduce((s, a) => s + a.movingSec, 0)).replace(/:\d\d$/, "")}</div><div className="text-[11px] text-mute mt-1">tempo</div></div>
            </div>
          </div>
          <div className="flex items-end gap-1.5 h-12 mt-4">
            {days.map((x, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className={`w-full ${x.km > 0 ? "bg-lime" : "bg-line"}`} style={{ height: `${Math.max(3, (x.km / maxDay) * 36)}px` }} />
                <span className="text-[9px] text-mute uppercase">{x.d.toLocaleDateString("pt-BR", { weekday: "narrow" })}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Missões recomendadas */}
        {missions.length > 0 && (
          <section className="mt-6">
            <div className="flex items-center justify-between mb-3"><h2 className="text-[15px] font-semibold">Missões recomendadas</h2><Link href="/missions" className="tap text-[12px] text-mute flex items-center gap-1">Ver todas<Icon name="chevron" size={14} /></Link></div>
            <div className="space-y-2">
              {missions.map((c) => { const pct = Math.min(100, (c.progress / c.goal) * 100); return (
                <Link key={c.name} href="/missions" className="tap flex items-center gap-3 panel p-3">
                  <span className="w-10 h-10 flex items-center justify-center border text-lime shrink-0"><Icon name={c.icon} size={20} /></span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[14px] truncate">{c.name}</span>
                    <span className="block h-[3px] bg-line mt-2"><span className="block h-full bg-lime" style={{ width: `${pct}%` }} /></span>
                  </span>
                  <span className="num text-[13px] text-mute w-10 text-right">{Math.round(pct)}%</span>
                </Link>); })}
            </div>
          </section>
        )}

        {/* Recentes */}
        {all.length > 0 && (
          <section className="mt-6">
            <h2 className="text-[15px] font-semibold mb-3">Suas atividades recentes</h2>
            <div className="-mx-4 px-4 flex gap-2 overflow-x-auto no-scrollbar snap-x">
              {all.slice(0, 8).map((a) => (
                <Link key={a.id} href={`/activities/${a.id}`} className="tap snap-start shrink-0 w-[150px] panel p-3">
                  <Icon name={a.sport} size={20} className="text-mute" />
                  <div className="num text-2xl mt-3">{fmtKm(a.distanceM)}<span className="text-[11px] text-mute font-sans ml-1">km</span></div>
                  <div className="text-[12px] text-mute truncate mt-0.5">{getSport(a.sport).label}</div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Feed */}
        <section className="mt-7">
          <h2 className="text-[15px] font-semibold mb-3">Feed</h2>
          {feed.length === 0 ? (
            <Link href="/welcome" className="tap block relative h-[260px] overflow-hidden">
              <Image src={hero} alt="Atleta em trilha de montanha" fill placeholder="blur" sizes="480px" className="object-cover" />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(16,17,18,0)_30%,rgba(16,17,18,.92)_100%)]" />
              <div className="absolute bottom-4 left-4 right-4">
                <div className="display text-[32px]">Sua primeira<br />rota espera.</div>
                <p className="text-[13px] text-bone/75 mt-2">Grave e publique com fotos para aparecer aqui.</p>
              </div>
            </Link>
          ) : (
            <div className="-mx-4 space-y-2">
              {feed.map((a) => <ActivityCard key={a.id} a={{ ...a, points: simplify(a.points, 200).map((p) => ({ lat: p.lat, lng: p.lng })), photos: a.photos.map((p) => p.id) }} />)}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
