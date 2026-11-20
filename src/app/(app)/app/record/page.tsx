import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { IconChevron, SportIcon } from "@/components/icons";
import { UPCOMING_SPORTS, SPORT_GROUPS } from "@/lib/sports";

export const dynamic = "force-dynamic";

const GROUP_COPY: Record<string, string> = {
  run: "Pace ao vivo, splits por quilômetro e calorias por intensidade.",
  walk: "Altimetria real, históricos longos e cadência confortável.",
  ride: "Velocidade instantânea, média e máxima, com pausa automática.",
};

export default async function RecordPage() {
  const user = await requireUser();

  return (
    <AppShell user={user} title="Gravar atividade" backHref="/app" subtitle="Escolha a modalidade">
      <div className="space-y-6">
        {SPORT_GROUPS.map((group, gi) => (
          <section key={group.key}>
            <div className="mb-3 flex items-baseline gap-3">
              <span className="metric text-[11px] font-bold text-lime">0{gi + 1}</span>
              <h2 className="display-2 text-[16px]">{group.label}</h2>
            </div>
            <p className="mb-3 text-[12px] leading-relaxed text-muted">{GROUP_COPY[group.key]}</p>
            <div className="divide-y divide-line border-t border-line">
              {group.sports.map((sport) => (
                <Link key={sport.key} href={`/app/record/${sport.key}`} className="group flex items-center gap-3.5 py-3.5 pl-3.5 pr-3 transition-colors active:bg-graphite-2">
                  <SportIcon sport={sport.key} className="size-[26px] shrink-0 text-paper transition-colors group-active:text-lime" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-semibold">{sport.label}</p>
                    <p className="mt-0.5 truncate text-[11px] leading-snug text-muted">{sport.description}</p>
                  </div>
                  <span className="metric shrink-0 border border-line px-2 py-1 text-[10px] font-bold text-muted">
                    {sport.usesPace ? "PACE" : "KM/H"}
                  </span>
                  <IconChevron className="size-3.5 shrink-0 text-muted transition-transform group-hover:translate-x-0.5" />
                </Link>
              ))}
            </div>
          </section>
        ))}

        <section>
          <div className="mb-3 flex items-baseline gap-3">
            <span className="metric text-[11px] font-bold text-muted">04</span>
            <h2 className="display-2 text-[16px] text-muted">Em breve</h2>
          </div>
          <div className="border border-line bg-graphite p-4">
            <p className="text-[12px] leading-relaxed text-muted">
              A arquitetura de métricas já está preparada para as próximas modalidades, com campos e fórmulas próprias.
            </p>
            <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2.5 sm:grid-cols-3">
              {UPCOMING_SPORTS.map((s) => (
                <li key={s.key} className="flex items-center gap-2 text-[12px] text-muted">
                  <span className="size-1 shrink-0 bg-line" />
                  {s.label}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="border border-line bg-graphite p-4">
          <div className="flex items-center justify-between">
            <p className="display-2 text-[14px]">Pausa automática</p>
            <span className={`metric border px-2 py-1 text-[10px] font-bold ${user.autoPause ? "border-lime/40 text-lime" : "border-line text-muted"}`}>
              {user.autoPause ? "ON" : "OFF"}
            </span>
          </div>
          <p className="mt-2 text-[12px] leading-relaxed text-muted">
            {user.autoPause
              ? "O cronômetro de movimento pausa sozinho quando você para e retoma ao voltar a se mover — ideal para semáforos no pedal."
              : "Ative nas configurações do perfil para pausar automaticamente quando você parar de se mover."}
          </p>
        </section>
      </div>
    </AppShell>
  );
}
