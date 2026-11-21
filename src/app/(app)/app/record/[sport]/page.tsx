import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { RecordClient } from "@/components/RecordClient";
import { Card, EmptyState } from "@/components/ui";
import { SPORTS, UPCOMING_SPORTS } from "@/lib/sports";

export const dynamic = "force-dynamic";

export default async function RecordSportPage({ params }: { params: Promise<{ sport: string }> }) {
  const user = await requireUser();
  const { sport } = await params;
  const def = SPORTS[sport];

  if (!def) {
    return (
      <AppShell user={user} title="Modalidade" backHref="/app/record">
        <EmptyState emoji="🤔" title="Modalidade não encontrada" description="Escolha uma modalidade disponível para começar a gravar." cta="Voltar" href="/app/record" />
      </AppShell>
    );
  }

  if (!def.available) {
    return (
      <AppShell user={user} title={def.label} backHref="/app/record">
        <EmptyState
          emoji={def.emoji}
          title={`${def.label} chega em breve`}
          description={`${def.description} A arquitetura de métricas já está preparada para esta modalidade.`}
          cta="Ver modalidades disponíveis"
          href="/app/record"
        />
        <div className="mt-4 grid grid-cols-2 gap-2">
          {UPCOMING_SPORTS.filter((s) => s.available === false).map((s) => (
            <Card key={s.key} className="p-3 text-[12px] text-muted">
              {s.emoji} {s.label}
            </Card>
          ))}
        </div>
      </AppShell>
    );
  }

  const deviceName =
    typeof navigator === "undefined" ? "GPS do dispositivo" : "GPS do dispositivo (alta precisão)";

  return (
    <AppShell user={user} title={def.label} backHref="/app/record" hideNav>
      <RecordClient sportKey={def.key} weightKg={user.weightKg ?? 72} deviceName={deviceName} />
      <Link href="/app/record" className="mt-2 block text-center text-xs font-semibold text-muted">
        Trocar modalidade
      </Link>
    </AppShell>
  );
}
