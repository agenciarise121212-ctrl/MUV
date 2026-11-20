import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { challenges } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { Card, Pill, ProgressBar } from "@/components/ui";
import { Avatar } from "@/components/Avatar";
import { JoinChallengeButton } from "@/components/actions";
import { challengeLeaderboard, challengesForUser } from "@/lib/data";
import { formatDuration, formatDistance, formatNumber, pct } from "@/lib/format";
import { SPORTS } from "@/lib/sports";

export const dynamic = "force-dynamic";

export default async function ChallengeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isInteger(id)) notFound();

  const rows = await db.select().from(challenges).where(eq(challenges.id, id)).limit(1);
  const challenge = rows[0];
  if (!challenge) notFound();

  const all = await challengesForUser(user.id);
  const mine = all.find((c) => c.id === id);
  const board = await challengeLeaderboard(id, 20);
  const metricLabel =
    challenge.metric === "distance_m"
      ? "Distância"
      : challenge.metric === "elev_gain_m"
        ? "Elevação"
        : challenge.metric === "moving_sec"
          ? "Tempo em movimento"
          : "Atividades";

  function fmt(value: number): string {
    if (challenge.metric === "moving_sec") return formatDuration(value, true);
    if (challenge.metric === "distance_m") return formatDistance(value);
    return formatNumber(value, 0);
  }

  return (
    <AppShell user={user} title={challenge.name} backHref="/app/challenges">
      <Card className="p-4">
        <div className="flex items-start gap-3">
          <span className="text-3xl">{challenge.emoji}</span>
          <div className="min-w-0 flex-1">
            <p className="text-base font-black leading-tight">{challenge.name}</p>
            <p className="mt-1 text-[12px] text-muted">{challenge.description}</p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <Pill tone="lime">{metricLabel}</Pill>
          <Pill>{challenge.sport ? SPORTS[challenge.sport]?.label ?? "Geral" : "Todas as modalidades"}</Pill>
          <Pill>termina {new Date(challenge.endAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}</Pill>
        </div>
        {mine ? (
          <div className="mt-4">
            <div className="flex justify-between text-[11px] text-muted">
              <span>Seu progresso</span>
              <span className="tabular">
                {fmt(mine.myProgress)} / {fmt(challenge.target)}
              </span>
            </div>
            <div className="mt-1.5">
              <ProgressBar pct={pct(mine.myProgress, challenge.target)} color="#ff7a3d" />
            </div>
          </div>
        ) : null}
        <div className="mt-4">
          <JoinChallengeButton challengeId={challenge.id} joined={Boolean(mine?.joined)} />
        </div>
      </Card>

      <section className="mt-6">
        <h2 className="mb-2 text-[14px] font-semibold">Classificação ({board.length})</h2>
        <Card className="divide-y divide-line">
          {board.length === 0 ? (
            <p className="px-4 py-4 text-[13px] text-muted">Ninguém participando ainda. Seja o primeiro!</p>
          ) : (
            board.map((row, index) => (
              <div key={row.userId} className="flex items-center gap-3 px-4 py-3">
                <span className={`tabular w-6 text-sm font-black ${index === 0 ? "text-amber-300" : "text-muted"}`}>{index + 1}</span>
                <Avatar name={row.name} color={row.avatarColor} size={34} href={`/app/athletes/${row.username}`} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-semibold">{row.name}</p>
                  <p className="text-[11px] text-muted">@{row.username}</p>
                </div>
                <div className="text-right">
                  <p className="tabular text-[14px] font-semibold text-lime">{fmt(row.progress)}</p>
                  {row.completedAt ? <p className="text-[10px] text-amber-300">concluído</p> : null}
                </div>
              </div>
            ))
          )}
        </Card>
      </section>

      <p className="mt-3 text-center text-[11px] text-muted">
        Progresso calculado a partir das atividades reais publicadas no período do desafio.
      </p>
    </AppShell>
  );
}
