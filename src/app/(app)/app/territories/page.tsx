import { requireUser } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { Card, ProgressBar } from "@/components/ui";
import { ClaimTerritoriesButton } from "@/components/actions";
import MapCanvas from "@/components/MapCanvas";
import { territoriesForUser } from "@/lib/data";
import { formatDistance, formatNumber } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function TerritoriesPage() {
  const user = await requireUser();
  const territories = await territoriesForUser(user.id);
  const owned = territories.filter((t) => t.claimed);
  const circles = territories.map((t) => ({
    center: [t.centerLng, t.centerLat] as [number, number],
    radiusM: t.radiusM,
    color: t.claimed ? "#d5ff45" : "#59b7ff",
  }));
  const totalOwners = territories.reduce((sum, t) => sum + t.owners, 0);

  return (
    <AppShell user={user} title="Territórios" backHref="/app">
      <Card className="p-4">
        <p className="text-[14px] font-semibold">Domine a cidade com atividades reais</p>
        <p className="mt-1 text-[12px] leading-relaxed text-muted">
          Todo trajeto gravado com GPS é comparado ao raio de cada território. Percorra pelo menos 250 m dentro de uma área para
          conquistá-la e receber XP e moedas exclusivas.
        </p>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="tabular text-xl font-black text-lime">{owned.length}</p>
            <p className="text-[10px] uppercase tracking-wider text-muted">seus</p>
          </div>
          <div>
            <p className="tabular text-xl font-black">{territories.length}</p>
            <p className="text-[10px] uppercase tracking-wider text-muted">total</p>
          </div>
          <div>
            <p className="tabular text-xl font-black text-sky">{formatNumber(totalOwners)}</p>
            <p className="text-[10px] uppercase tracking-wider text-muted">conquistas</p>
          </div>
        </div>
        <div className="mt-3">
          <ProgressBar pct={(owned.length / Math.max(1, territories.length)) * 100} color="#d5ff45" />
        </div>
      </Card>

      <div className="mt-3 overflow-hidden rounded-2xl hairline">
        <div className="relative h-[300px]">
          <MapCanvas className="absolute inset-0" circles={circles} autoFit />
        </div>
      </div>

      <div className="mt-4">
        <ClaimTerritoriesButton />
      </div>

      <section className="mt-6 space-y-2">
        <h2 className="text-[14px] font-semibold uppercase tracking-[0.16em] text-muted">Mapa de territórios</h2>
        {territories.map((t) => (
          <Card key={t.id} className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[14px] font-semibold">
                  {t.emoji} {t.name}
                </p>
                <p className="text-[11px] text-muted">
                  {t.region} · raio {formatDistance(t.radiusM, 0)}
                </p>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${t.claimed ? "bg-lime/15 text-lime" : "bg-surface-3 text-muted"}`}>
                {t.claimed ? "dominado" : "livre"}
              </span>
            </div>
            {t.description ? <p className="mt-2 text-[12px] leading-relaxed text-muted">{t.description}</p> : null}
            <p className="mt-2 text-[11px] text-muted">
              {t.owners} atleta(s) dominaram{t.lastOwner ? ` · último: ${t.lastOwner}` : ""}
            </p>
            {t.claimed ? (
              <p className="mt-1 text-[11px] font-bold text-lime">
                Você percorreu {formatDistance(t.myDistanceInsideM)} dentro deste território
              </p>
            ) : (
              <p className="mt-1 text-[11px] text-sky">
                Recompensa: +{t.xpReward} XP · +{t.coinsReward} moedas
              </p>
            )}
          </Card>
        ))}
      </section>
    </AppShell>
  );
}
