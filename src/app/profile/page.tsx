import Link from "next/link";
import { wallet } from "@/lib/rpg";
import { listActivities } from "@/lib/queries";
import { achievements, level, personalRecords, territories } from "@/lib/gamification";
import { fmtDate, fmtKm, fmtPace, fmtSpeed, fmtTime } from "@/lib/format";
import { getSport } from "@/lib/sports";
import Icon from "@/components/Icon";
import PageHead from "@/components/PageHead";
import Tabs from "@/components/Tabs";
import Settings from "@/components/Settings";
import EmblemIcon, { Coin3D } from "@/components/EmblemIcon";

const ACH_EMBLEM: Record<string, string> = { flag: "flag-bike-mountain", bolt: "potion-lightning", run: "medal-bike", medal: "shield-star-laurel", trophy: "trophy-gold", road_bike: "badge-mtb-trail", gravel: "helmet-cycling-blue", hike: "compass", mountain: "mountain-route-pin", pin: "portal-blue", route: "target-red" };

export const dynamic = "force-dynamic";

export default async function Profile({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const tab = (await searchParams).tab ?? "stats";
  const all = await listActivities();
  const ach = achievements(all);
  const terr = territories(all);
  const wal = await wallet();
  const lv = level(all, wal.xp);
  const photos = all.flatMap((a) => a.photos.map((p) => ({ id: p.id, activityId: a.id })));
  const groups = [{ key: "corrida", label: "Corrida", icon: "run" }, { key: "ciclismo", label: "Ciclismo", icon: "road_bike" }, { key: "caminhada", label: "Caminhada", icon: "hike" }];
  const totals = (g: string) => { const l = all.filter((a) => getSport(a.sport).group === g); return { n: l.length, km: l.reduce((s, a) => s + a.distanceM, 0), sec: l.reduce((s, a) => s + a.movingSec, 0) }; };
  const done = ach.filter((x) => x.done).length;

  return (
    <div className="px-4 pb-nav">
      <PageHead title="Perfil" action={<Link href="/profile?tab=ajustes" replace aria-label="Configurações" className="tap w-10 h-10 flex items-center justify-center"><Icon name="settings" size={20} /></Link>} />

      <section className="pt-5 pb-5 flex items-center gap-4">
        <div className="relative w-[72px] h-[72px] shrink-0">
          <svg viewBox="0 0 72 72" className="absolute inset-0 -rotate-90"><circle cx="36" cy="36" r="34" fill="none" stroke="#2A2D31" strokeWidth="2" /><circle cx="36" cy="36" r="34" fill="none" stroke="#D5FF45" strokeWidth="2" strokeDasharray={`${(lv.pct / 100) * 213.6} 213.6`} /></svg>
          <div className="absolute inset-[6px] rounded-full bg-graphite flex items-center justify-center display text-3xl">A</div>
          <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-lime text-ink text-[10px] font-bold px-1.5 num">NV {lv.level}</span>
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-[22px] font-semibold tracking-tight">Atleta MUV</h1>
          <p className="text-[12px] text-mute num flex items-center gap-1 flex-wrap"><span className="inline-flex items-center gap-1 text-bone"><Coin3D size={13} />{wal.coins}</span> · {lv.xp} XP · faltam {lv.next - lv.xp} para o nível {lv.level + 1}</p>
        </div>
      </section>

      <div className="grid grid-cols-4 gap-px bg-line border border-line mb-1">
        {[[String(all.length), "ativid."], [fmtKm(all.reduce((s, a) => s + a.distanceM, 0), 0), "km"], [String(terr), "territ."], [`${done}`, "conquist."]].map(([v, l], i) => (
          <div key={l} className="bg-ink py-3 text-center"><div className={`num text-xl ${i === 2 ? "text-lime" : ""}`}>{v}</div><div className="text-[10px] text-mute">{l}</div></div>
        ))}
      </div>

      <Tabs base="/profile" active={tab} tabs={[{ k: "stats", l: "Estatísticas" }, { k: "atividades", l: "Atividades", n: all.length }, { k: "conquistas", l: "Conquistas" }, { k: "colecao", l: "Coleção", n: photos.length }, { k: "ajustes", l: "Ajustes" }]} />

      <div className="pt-4">
        {tab === "stats" && (
          <div className="space-y-6">
            {groups.map((g) => { const t = totals(g.key); const pr = personalRecords(all, g.key); const speed = g.key === "ciclismo"; return (
              <section key={g.key} className="panel">
                <div className="flex items-center gap-3 p-4 border-b border-line">
                  <Icon name={g.icon} size={20} className="text-mute" /><span className="text-[14px] font-medium flex-1">{g.label}</span>
                  <span className="num text-xl">{fmtKm(t.km, 1)}<span className="text-[11px] text-mute font-sans ml-1">km</span></span>
                </div>
                <div className="px-4 py-1 text-[13px]">
                  {([["Atividades", String(t.n), null], ["Tempo total", fmtTime(t.sec), null], ["Mais longa", pr.longest ? `${fmtKm(pr.longest.distanceM)} km` : "—", pr.longest], [speed ? "Melhor média" : "Melhor pace", pr.fastestAvg ? (speed ? `${fmtSpeed(pr.fastestAvg.avgSpeed)} km/h` : `${fmtPace(pr.fastestAvg.avgSpeed)} /km`) : "—", pr.fastestAvg], ...(speed ? [["Vel. máxima", pr.maxSpeed ? `${fmtSpeed(pr.maxSpeed.maxSpeed)} km/h` : "—", pr.maxSpeed] as const] : []), ["Mais elevação", pr.mostElev ? `${Math.round(pr.mostElev.elevGainM)} m` : "—", pr.mostElev]] as const).map(([l, v, a]) => (
                    <div key={l} className="flex justify-between py-2.5 border-b border-line last:border-0">
                      <span className="text-mute">{l}</span>
                      {a ? <Link href={`/activities/${a.id}`} className="tap num">{v}</Link> : <span className="num">{v}</span>}
                    </div>
                  ))}
                </div>
              </section>); })}
          </div>
        )}

        {tab === "atividades" && (
          all.length === 0 ? <p className="py-14 text-center text-[13px] text-mute">Nenhuma atividade ainda.</p> : (
            <div>
              {all.map((a) => { const s = getSport(a.sport); return (
                <Link key={a.id} href={`/activities/${a.id}`} className="tap flex items-center gap-3 py-3 border-b border-line">
                  {a.photos[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`/api/photos/${a.photos[0].id}`} alt="" className="w-12 h-12 object-cover shrink-0" />
                  ) : <span className="w-12 h-12 border flex items-center justify-center text-mute shrink-0"><Icon name={s.key} size={22} /></span>}
                  <span className="flex-1 min-w-0"><span className="block text-[14px] truncate">{a.title}</span><span className="block text-[11px] text-mute">{fmtDate(a.startedAt)}</span></span>
                  <span className="text-right"><span className="block num">{fmtKm(a.distanceM)} km</span><span className="block text-[11px] text-mute num">{fmtTime(a.movingSec)}</span></span>
                </Link>); })}
              <Link href="/activities" className="tap btn btn-ghost w-full mt-4">Histórico completo</Link>
            </div>
          )
        )}

        {tab === "conquistas" && (
          <div className="grid grid-cols-3 gap-px bg-line border border-line">
            {ach.map((x) => (
              <div key={x.name} className="bg-ink p-3 min-h-[120px] flex flex-col justify-between">
                <EmblemIcon name={ACH_EMBLEM[x.icon] ?? "trophy-gold"} size={48} dim={!x.done} />
                <span className={`text-[12px] leading-snug ${x.done ? "" : "text-mute/60"}`}>{x.name}</span>
              </div>
            ))}
          </div>
        )}

        {tab === "colecao" && (
          photos.length === 0 ? <p className="py-14 text-center text-[13px] text-mute">As fotos das suas atividades formam sua coleção.</p> : (
            <div className="-mx-4 grid grid-cols-3 gap-px">
              {photos.map((p) => (
                <Link key={p.id} href={`/activities/${p.activityId}`} className="tap aspect-square block overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/api/photos/${p.id}`} alt="" loading="lazy" className="w-full h-full object-cover" />
                </Link>
              ))}
            </div>
          )
        )}

        {tab === "ajustes" && <Settings />}
      </div>
    </div>
  );
}
