import Link from "next/link";
import { listActivities } from "@/lib/queries";
import { achievements, challenges } from "@/lib/gamification";
import PageHead from "@/components/PageHead";
import Tabs from "@/components/Tabs";
import Icon from "@/components/Icon";
import EmblemIcon, { Coin3D, Xp3D } from "@/components/EmblemIcon";
import { listMissions, wallet } from "@/lib/rpg";
import { level } from "@/lib/gamification";
import { emblemDef, BOSS_STYLE } from "@/lib/emblems";

const CH_EMBLEM: Record<string, string> = { run: "medal-bike", road_bike: "badge-mtb-trail", mountain: "mountain-route-pin", walk: "compass", target: "target-red" };
const GEO_LABEL: Record<string, string> = { photo: "Check-in fotográfico", exploration: "Exploração", chest: "Baú", collectible: "Colecionável", secret: "Secreta", climb: "Subida", trail: "Trilha", route: "Percurso", boss: "Boss", distance: "Distância", endurance: "Resistência" };
const ST: Record<string, string> = { available: "Disponível", unlocked: "Desbloqueada", in_progress: "Em andamento", paused: "Pausada", completed: "Concluída" };

export const dynamic = "force-dynamic";

export default async function Missions({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const tab = (await searchParams).tab ?? "mapa";
  const all = await listActivities();
  const geo = await listMissions();
  const wal = await wallet();
  const lv = level(all, wal.xp);
  const geoOpen = geo.filter((m) => m.status !== "completed" && (!m.expiresAt || m.expiresAt > new Date()));
  const ch = challenges(all).map((c) => ({ ...c, pct: Math.min(100, (c.progress / c.goal) * 100) }));
  const ach = achievements(all);
  const active = ch.filter((c) => c.pct < 100);
  const near = active.filter((c) => c.pct >= 50);
  const done = [...geo.filter((m) => m.status === "completed").map((m) => ({ icon: m.emblem, name: m.title, sub: `Mapa · +${m.xp} XP`, emblem: true })), ...ch.filter((c) => c.pct >= 100).map((c) => ({ icon: c.icon, name: c.name, sub: "Desafio do mês" })), ...ach.filter((a) => a.done).map((a) => ({ icon: a.icon, name: a.name, sub: "Conquista" }))];
  const now = new Date();
  const daysLeft = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate();

  const Mission = ({ c }: { c: (typeof ch)[number] }) => (
    <div className="panel p-4">
      <div className="flex items-start gap-3">
        <EmblemIcon name={CH_EMBLEM[c.icon] ?? "target-red"} size={46} dim={false} className="shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-[15px] font-medium">{c.name}</div>
          <div className="text-[12px] text-mute mt-0.5 flex items-center gap-1.5"><Icon name="medal" size={12} />{c.reward}</div>
        </div>
        <span className="num text-[13px]">{Math.round(c.pct)}%</span>
      </div>
      <div className="h-[3px] bg-line mt-4"><div className="h-full bg-lime" style={{ width: `${c.pct}%` }} /></div>
      <div className="flex justify-between text-[11px] text-mute mt-2 num"><span>{c.progress.toFixed(c.unit === "km" ? 1 : 0)} / {c.goal} {c.unit}</span><span>{daysLeft} dias restantes</span></div>
    </div>
  );

  return (
    <div className="px-4 pb-nav">
      <PageHead title="Missões" />
      <div className="pt-5 pb-4">
        <div className="eyebrow">Campanha · Operação Evolução</div>
        <h1 className="display text-[40px] mt-2">Missões</h1>
        <div className="flex items-center gap-4 mt-3 text-[13px] num">
          <span className="flex items-center gap-1.5"><Xp3D size={18} />{lv.xp} XP</span>
          <span className="flex items-center gap-1.5"><Coin3D size={18} />{wal.coins}</span>
          <span className="text-mute">Nível {lv.level}</span>
        </div>
        <div className="h-[3px] bg-line mt-3"><div className="h-full bg-lime" style={{ width: `${lv.pct}%` }} /></div>
      </div>
      <Tabs base="/missions" active={tab} tabs={[{ k: "mapa", l: "No mapa", n: geoOpen.length }, { k: "ativas", l: "Mensais", n: active.length }, { k: "proximas", l: "Quase lá", n: near.length }, { k: "concluidas", l: "Concluídas", n: done.length }, { k: "recompensas", l: "Recompensas" }]} />
      <div className="pt-4 space-y-2">
        {tab === "ativas" && (active.length ? active.map((c) => <Mission key={c.name} c={c} />) : <Empty text="Todas as missões do mês foram concluídas." />)}
        {tab === "proximas" && (near.length ? near.map((c) => <Mission key={c.name} c={c} />) : <Empty text="Missões com mais de 50% de progresso aparecem aqui." />)}
        {tab === "mapa" && (geoOpen.length ? geoOpen.map((m) => (
          <Link key={m.id} href="/map" className="tap flex items-center gap-3 panel p-3">
            <EmblemIcon name={m.type === "secret" ? "crystal-purple" : m.emblem} size={52} filter={m.type === "boss" && m.category ? BOSS_STYLE[m.category]?.filter : undefined} className="shrink-0" />
            <span className="flex-1 min-w-0">
              <span className="block text-[11px] text-mute uppercase tracking-wider">{GEO_LABEL[m.type]} · {ST[m.status]}</span>
              <span className="block text-[14px] font-medium truncate mt-0.5">{m.type === "secret" ? "Missão secreta" : m.title}</span>
              {m.hpMax ? <span className="block h-1 bg-line mt-2"><span className="block h-full bg-[#E5484D]" style={{ width: `${((m.hp ?? 0) / m.hpMax) * 100}%` }} /></span> : <span className="flex gap-0.5 mt-2">{[1, 2, 3, 4].map((i) => <span key={i} className={`w-1.5 h-2.5 ${i <= m.difficulty ? "bg-bone" : "bg-line"}`} />)}</span>}
            </span>
            <span className="text-right shrink-0"><span className="flex items-center gap-1 num text-[13px] justify-end"><Xp3D size={13} />{m.xp}</span><span className="flex items-center gap-1 num text-[11px] text-mute justify-end mt-1"><Coin3D size={12} />{m.coins}</span></span>
          </Link>)) : <div className="py-12 text-center"><EmblemIcon name="portal-blue" size={72} className="mx-auto" /><p className="text-[13px] text-mute mt-4">Abra o mapa e busque missões reais ao seu redor.</p><Link href="/map" className="tap btn btn-lime btn-sm mt-4">Abrir mapa</Link></div>)}
        {tab === "concluidas" && (done.length ? done.map((d) => (
          <div key={d.name} className="flex items-center gap-3 py-3 border-b border-line">
            {"emblem" in d ? <EmblemIcon name={d.icon} size={40} className="shrink-0" /> : <span className="w-10 h-10 bg-lime text-ink flex items-center justify-center shrink-0"><Icon name={d.icon} size={20} /></span>}
            <span className="flex-1"><span className="block text-[14px]">{d.name}</span><span className="block text-[11px] text-mute">{d.sub}</span></span>
            <Icon name="check" size={18} className="text-lime" />
          </div>)) : <Empty text="Complete sua primeira missão para vê-la aqui." />)}
        {tab === "recompensas" && (<>
          <h3 className="eyebrow pt-2 pb-2">Inventário</h3>
          {wal.inventory.length === 0 ? <p className="text-[13px] text-mute pb-4">Itens capturados no mapa aparecem aqui.</p> : (
            <div className="grid grid-cols-3 gap-px bg-line border border-line mb-5">
              {wal.inventory.map((i) => <div key={i.item} className="bg-ink p-3 flex flex-col items-center text-center gap-2"><EmblemIcon name={i.item} size={56} /><span className="text-[11px] leading-tight">{emblemDef(i.item).label}</span><span className="num text-[11px] text-mute">×{i.qty}</span></div>)}
            </div>
          )}
          {wal.recent.length > 0 && <>
            <h3 className="eyebrow pb-2">Histórico de recompensas</h3>
            <div className="mb-5">{wal.recent.map((r) => <div key={r.id} className="flex items-center gap-3 py-2.5 border-b border-line text-[13px]"><span className="flex-1 min-w-0 truncate">{r.label}</span><span className="num text-[12px] flex items-center gap-1 shrink-0"><Xp3D size={12} />{r.xp}</span>{r.coins > 0 && <span className="num text-[12px] flex items-center gap-1 shrink-0"><Coin3D size={12} />{r.coins}</span>}</div>)}</div>
          </>}
          <h3 className="eyebrow pb-2">Medalhas do mês</h3>
          <div className="grid grid-cols-2 gap-px bg-line border border-line">
            {ch.map((c) => (
              <div key={c.reward} className="bg-ink p-4 min-h-[140px] flex flex-col justify-between">
                <EmblemIcon name={c.pct >= 100 ? "trophy-gold" : "shield-star-laurel"} size={52} dim={c.pct < 100} />
                <span><span className={`block text-[13px] leading-snug ${c.pct >= 100 ? "" : "text-mute"}`}>{c.reward}</span><span className="block text-[11px] text-mute mt-1">{c.pct >= 100 ? "Desbloqueada" : `${Math.round(c.pct)}%`}</span></span>
              </div>
            ))}
          </div>
        </>)}
      </div>
      <Link href="/record" className="tap btn btn-lime w-full mt-6">Começar atividade</Link>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="py-14 text-center text-[13px] text-mute">{text}</div>;
}
