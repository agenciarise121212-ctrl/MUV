import Link from "next/link";
import { listActivities, simplify } from "@/lib/queries";
import { getSport } from "@/lib/sports";
import { fmtDate, fmtKm, fmtPace, fmtSpeed, fmtTime } from "@/lib/format";
import PageHead from "@/components/PageHead";
import Icon from "@/components/Icon";
import MapView from "@/components/MapView";

export const dynamic = "force-dynamic";

export default async function Compare({ searchParams }: { searchParams: Promise<{ a?: string; b?: string }> }) {
  const sp = await searchParams;
  const all = await listActivities();
  const A = all.find((x) => x.id === Number(sp.a));
  const group = A ? getSport(A.sport).group : null;
  const candidates = all.filter((x) => x.id !== A?.id && (!group || getSport(x.sport).group === group));
  const B = all.find((x) => x.id === Number(sp.b));
  const speed = group === "ciclismo";
  const rows: [string, (x: typeof all[number]) => number, (v: number) => string, boolean][] = [
    ["Distância", (x) => x.distanceM, (v) => `${fmtKm(v)} km`, true],
    ["Tempo em movimento", (x) => x.movingSec, fmtTime, false],
    [speed ? "Velocidade média" : "Pace médio", (x) => x.avgSpeed, (v) => (speed ? `${fmtSpeed(v)} km/h` : `${fmtPace(v)} /km`), true],
    [speed ? "Velocidade máxima" : "Melhor pace", (x) => x.maxSpeed, (v) => (speed ? `${fmtSpeed(v)} km/h` : `${fmtPace(v)} /km`), true],
    ["Elevação", (x) => x.elevGainM, (v) => `${Math.round(v)} m`, true],
    ["Calorias", (x) => x.calories, (v) => `${v} kcal`, true],
  ];
  return (
    <div className="px-4 pb-nav space-y-6">
      <PageHead title="Comparar" back="/profile?tab=ajustes" />
      {!A && (
        <div className="bg-graphite p-4 "><p className="text-sm mb-2">Escolha a primeira atividade:</p>
          {all.map((x) => <Link key={x.id} href={`/compare?a=${x.id}`} className="block py-3 border-t text-[15px] hover:text-lime transition-colors">{x.title} · {fmtKm(x.distanceM)} km · {fmtDate(x.startedAt)}</Link>)}
        </div>
      )}
      {A && !B && (
        <div className="bg-graphite p-4 "><p className="text-sm mb-2">Comparar <b>{A.title}</b> com:</p>
          {candidates.length === 0 && <p className="text-sm text-mute">Nenhuma outra atividade da mesma categoria.</p>}
          {candidates.map((x) => <Link key={x.id} href={`/compare?a=${A.id}&b=${x.id}`} className="block py-3 border-t text-[15px] hover:text-lime transition-colors">{x.title} · {fmtKm(x.distanceM)} km · {fmtDate(x.startedAt)}</Link>)}
        </div>
      )}
      {A && B && (
        <>
          <div className="grid grid-cols-2 gap-3">
            {[A, B].map((x) => (
              <Link key={x.id} href={`/activities/${x.id}`} className="panel overflow-hidden block">
                {x.points.length > 1 ? <MapView points={simplify(x.points, 200).map((p) => ({ lat: p.lat, lng: p.lng }))} interactive={false} className="h-36 pointer-events-none" /> : <div className="h-36 bg-ink flex items-center justify-center text-mute"><Icon name={x.sport} size={36} /></div>}
                <div className="p-2"><div className="font-semibold text-sm truncate">{x.title}</div><div className="text-xs text-mute">{fmtDate(x.startedAt)}</div></div>
              </Link>
            ))}
          </div>
          <table className="w-full panel text-sm overflow-hidden">
            <tbody>
              {rows.map(([l, f, fmt, higher]) => { const va = f(A), vb = f(B); const aw = higher ? va > vb : va < vb; const bw = higher ? vb > va : vb < va; return (
                <tr key={l} className="border-t first:border-0">
                  <td className={`p-4 text-right num text-xl ${aw ? "text-lime" : ""}`}>{fmt(va)}</td>
                  <td className="p-4 text-center eyebrow !text-[10px]">{l}</td>
                  <td className={`p-4 num text-xl ${bw ? "text-lime" : ""}`}>{fmt(vb)}</td>
                </tr>); })}
            </tbody>
          </table>
          <Link href={`/compare?a=${A.id}`} className="text-sm text-lime font-semibold">Trocar a segunda atividade</Link>
        </>
      )}
    </div>
  );
}
