import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { Card, Pill, ProgressBar, SectionTitle } from "@/components/ui";
import { CreateChallengeForm, JoinChallengeButton } from "@/components/actions";
import { challengesForUser } from "@/lib/data";
import { formatNumber, pct } from "@/lib/format";
import { SPORTS } from "@/lib/sports";

export const dynamic = "force-dynamic";

export default async function ChallengesPage() {
  const user = await requireUser();
  const challenges = await challengesForUser(user.id);
  const joined = challenges.filter((c) => c.joined);
  const open = challenges.filter((c) => !c.joined);
  const sports = Object.values(SPORTS).map((s) => ({ key: s.key, label: s.label }));

  return (
    <AppShell user={user} title="Desafios" backHref="/app">
      <div className="grid grid-cols-3 gap-2">
        <MiniStat label="Participando" value={String(joined.length)} />
        <MiniStat label="Concluídos" value={String(joined.filter((c) => c.myCompletedAt).length)} />
        <MiniStat label="Abertos" value={String(open.length)} />
      </div>

      <section className="mt-6">
        <SectionTitle title="Meus desafios" />
        {joined.length === 0 ? (
          <Card className="p-4 text-[13px] text-muted">
            Você ainda não participa de nenhum desafio. Entre em um desafio abaixo — suas atividades já registradas no período
            contam automaticamente para o progresso.
          </Card>
        ) : (
          <div className="space-y-2">
            {joined.map((c) => (
              <Card key={c.id} className="p-4">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{c.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <Link href={`/app/challenges/${c.id}`} className="truncate text-[14px] font-semibold">
                      {c.name}
                    </Link>
                    <p className="text-[11px] text-muted">
                      {c.sport ? SPORTS[c.sport]?.label ?? "Todas" : "Todas as modalidades"} · até{" "}
                      {new Date(c.endAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                    </p>
                  </div>
                  {c.myCompletedAt ? <Pill tone="gold">concluído</Pill> : null}
                </div>
                <div className="mt-3">
                  <ProgressBar pct={pct(c.myProgress, c.target)} color="#ff7a3d" />
                </div>
                <p className="tabular mt-1.5 text-[11px] text-muted">
                  {formatNumber(c.myProgress, c.unit === "km" ? 1 : 0)} de {formatNumber(c.target, c.unit === "km" ? 1 : 0)}{" "}
                  {c.unit} · líder: {c.leaderName || "—"}
                </p>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="mt-8">
        <SectionTitle title="Desafios abertos" />
        <div className="mb-3">
          <CreateChallengeForm sports={sports} />
        </div>
        <div className="space-y-2">
          {open.length === 0 ? (
            <Card className="p-4 text-[13px] text-muted">Nenhum desafio aberto. Crie um e convide a comunidade.</Card>
          ) : (
            open.map((c) => (
              <Card key={c.id} className="p-4">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{c.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <Link href={`/app/challenges/${c.id}`} className="truncate text-[14px] font-semibold">
                      {c.name}
                    </Link>
                    <p className="text-[11px] text-muted">
                      Meta: {formatNumber(c.target, c.unit === "km" ? 1 : 0)} {c.unit} · {c.participants} participante(s)
                    </p>
                  </div>
                  <JoinChallengeButton challengeId={c.id} joined={c.joined} />
                </div>
                {c.description ? <p className="mt-2 text-[12px] leading-relaxed text-muted">{c.description}</p> : null}
              </Card>
            ))
          )}
        </div>
      </section>
    </AppShell>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-3 text-center">
      <p className="tabular text-xl font-black text-lime">{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-muted">{label}</p>
    </Card>
  );
}
