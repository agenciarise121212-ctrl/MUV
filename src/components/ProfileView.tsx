import Link from "next/link";
import type { User } from "@/db/schema";
import { Card, Pill, ProgressBar, SectionTitle } from "@/components/ui";
import { Avatar } from "@/components/Avatar";
import { PhotoGrid } from "@/components/Lightbox";
import { FollowButton, LogoutButton, ProfileEditor } from "@/components/actions";
import { ProfileMenu } from "@/components/AppShell";
import { ActivityCard } from "@/components/ActivityCard";
import type { FeedItem } from "@/lib/data";
import { formatDistance, formatDuration, formatNumber, formatPace, formatSpeed, pct, timeAgo } from "@/lib/format";
import { levelFromXp } from "@/lib/levels";
import { categoryLabel, isRideSport, type SportCategory } from "@/lib/sports";

type StatRow = {
  sport: string;
  count: number;
  distanceM: number;
  movingSec: number;
  elevGainM: number;
  calories: number;
  longestM: number;
  maxSpeed: number;
  bestPace: number;
};

export function ProfileView({
  user,
  viewer,
  stats,
  weekly,
  photos,
  achievements,
  activities,
  prs,
  territoriesOwned,
  social,
  isSelf,
  following,
}: {
  user: User;
  viewer: User;
  stats: StatRow[];
  weekly: { distanceM: number; movingSec: number; count: number }[];
  photos: { id: number; caption: string | null }[];
  achievements: { key: string; name: string; icon: string; description: string; tier: string; xpReward: number; unlockedAt: Date | null; progress: number; threshold: number }[];
  activities: FeedItem[];
  prs: { id: number; sport: string; label: string; value: number; unit: string }[];
  territoriesOwned: number;
  social: { followers: number; following: number };
  isSelf: boolean;
  following: boolean;
}) {
  const lvl = levelFromXp(user.xp);
  const totals = stats.reduce(
    (acc, s) => {
      acc.distanceM += s.distanceM;
      acc.movingSec += s.movingSec;
      acc.elevGainM += s.elevGainM;
      acc.count += s.count;
      acc.calories += s.calories;
      return acc;
    },
    { distanceM: 0, movingSec: 0, elevGainM: 0, count: 0, calories: 0 },
  );
  const unlocked = achievements.filter((a) => a.unlockedAt);
  const categories: SportCategory[] = ["ride", "run", "walk"];
  const maxDistance = Math.max(1, ...weekly.map((w) => w.distanceM));

  return (
    <>
      <Card className="p-4">
        <div className="flex items-start gap-3">
          <Avatar name={user.name} color={user.avatarColor} size={48} />
          <div className="min-w-0 flex-1">
            <p className="display-2 text-[16px]">{user.name}</p>
            <p className="text-[12px] text-muted">@{user.username}{user.city ? ` · ${user.city}` : ""}</p>
            {user.bio ? <p className="mt-1.5 text-[12px] leading-relaxed text-muted">{user.bio}</p> : null}
            <div className="mt-2 flex gap-3 text-[11px] text-muted">
              <span>
                <b className="tabular text-white">{formatNumber(totals.count)}</b> treinos
              </span>
              <span>
                <b className="tabular text-white">{social.followers}</b> seguidores
              </span>
              <span>
                <b className="tabular text-white">{social.following}</b> seguindo
              </span>
            </div>
          </div>
        </div>
        <div className="mt-4">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted">
              Nível {lvl.level} · {lvl.title}
            </p>
            <p className="tabular text-[11px] text-muted">{formatNumber(user.xp)} XP · {user.coins} moedas</p>
          </div>
          <div className="mt-1.5">
            <ProgressBar pct={lvl.pct} />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {isSelf ? (
            <>
              <ProfileEditor
                user={{
                  name: user.name,
                  username: user.username,
                  bio: user.bio,
                  city: user.city,
                  avatarColor: user.avatarColor,
                  weightKg: user.weightKg,
                  autoPause: user.autoPause,
                }}
              />
              <Link href="/app/rewards" className="btn btn-dark">
                Conquistas
              </Link>
            </>
          ) : (
            <>
              <FollowButton userId={user.id} initialFollowing={following} />
              <Pill tone="lime">{territoriesOwned} territórios</Pill>
            </>
          )}
        </div>
      </Card>

      <Card className="mt-3 p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Totais gerais</p>
        <div className="mt-3 grid grid-cols-4 gap-px border border-line bg-line text-center">
          <Cell label="Distância" value={formatDistance(totals.distanceM)} accent="#d5ff45" />
          <Cell label="Tempo" value={formatDuration(totals.movingSec, true)} />
          <Cell label="Ganho" value={`${formatNumber(totals.elevGainM)} m`} />
          <Cell label="Calorias" value={formatNumber(totals.calories)} />
        </div>
        <div className="mt-4 flex h-24 items-end gap-1.5">
          {weekly.map((w) => (
            <div key={w.distanceM + String(w.count)} className="flex flex-1 flex-col items-center gap-1">
              <div className="w-full rounded-t-md bg-flame/70" style={{ height: `${Math.max(3, (w.distanceM / maxDistance) * 80)}px` }} />
              <span className="text-[9px] text-muted">{formatNumber(w.distanceM / 1000, 0)}</span>
            </div>
          ))}
          {weekly.length === 0 ? <p className="text-[12px] text-muted">Sem histórico semanal ainda.</p> : null}
        </div>
      </Card>

      <section className="mt-6">
        <SectionTitle title="Estatísticas por modalidade" />
        <div className="space-y-2">
          {categories.map((cat) => {
            const rows = stats.filter((s) => isRideSport(s.sport) === (cat === "ride") && categoryOf(s.sport) === cat);
            if (rows.length === 0) return null;
            const catTotals = rows.reduce(
              (acc, s) => {
                acc.distanceM += s.distanceM;
                acc.movingSec += s.movingSec;
                acc.elevGainM += s.elevGainM;
                acc.count += s.count;
                return acc;
              },
              { distanceM: 0, movingSec: 0, elevGainM: 0, count: 0 },
            );
            return (
              <Card key={cat} className="p-4">
                <div className="flex items-center justify-between">
                  <p className="text-[14px] font-semibold">{categoryLabel(cat)}</p>
                  <Pill>{formatNumber(catTotals.count)} treinos</Pill>
                </div>
                <p className="tabular mt-2 text-xl font-black text-lime">{formatDistance(catTotals.distanceM)}</p>
                <p className="tabular text-[11px] text-muted">
                  {formatDuration(catTotals.movingSec, true)} · {formatNumber(catTotals.elevGainM)} m de ganho
                </p>
                <ul className="mt-3 space-y-1.5">
                  {rows.map((s) => (
                    <li key={s.sport} className="flex items-center justify-between bg-graphite-2 px-3 py-2">
                      <span className="text-[12px] font-semibold">
                        {cat === "ride" ? "🚴" : cat === "run" ? "🏃" : "🚶"} {s.count}x
                      </span>
                      <span className="tabular text-[11px] text-muted">
                        {formatDistance(s.distanceM)} ·{" "}
                        {isRideSport(s.sport)
                          ? `${formatSpeed(s.maxSpeed)} km/h máx`
                          : `${formatPace(s.bestPace)} /km melhor`}
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="mt-6">
        <SectionTitle title="Recordes pessoais" action="Ver atividade" href="/app/activities" />
        <Card className="divide-y divide-line">
          {prs.length === 0 ? (
            <p className="px-4 py-4 text-[13px] text-muted">Nenhum recorde registrado ainda.</p>
          ) : (
            prs.slice(0, 10).map((pr) => (
              <div key={pr.id} className="flex items-center justify-between px-4 py-2.5">
                <span className="text-[12px] font-semibold">{pr.label}</span>
                <span className="tabular text-[12px] font-bold text-lime">
                  {pr.unit === "m" ? formatDistance(pr.value) : pr.unit === "s" ? formatDuration(pr.value, true) : `${pr.value} ${pr.unit}`}
                </span>
              </div>
            ))
          )}
        </Card>
      </section>

      <section className="mt-6">
        <SectionTitle title={`Fotos (${photos.length})`} />
        {photos.length === 0 ? (
          <Card className="p-4 text-[13px] text-muted">Nenhuma foto publicada ainda. Adicione fotos ao finalizar um treino.</Card>
        ) : (
          <PhotoGrid photos={photos} />
        )}
      </section>

      <section className="mt-6">
        <SectionTitle title={`Conquistas (${unlocked.length}/${achievements.length})`} action="Ver todas" href="/app/rewards" />
        <div className="grid grid-cols-4 gap-2">
          {unlocked.slice(0, 8).map((a) => (
            <div key={a.key} className="surface p-3 text-center hairline">
              <p className="text-xl">{a.icon}</p>
              <p className="mt-1 truncate text-[10px] font-bold">{a.name}</p>
            </div>
          ))}
          {unlocked.length === 0 ? <p className="col-span-4 text-[13px] text-muted">Nenhuma conquista desbloqueada ainda.</p> : null}
        </div>
      </section>

      <section className="mt-6">
        <SectionTitle title="Atividades recentes" action="Ver todas" href="/app/activities" />
        <div className="space-y-3">
          {activities.slice(0, 8).map((item) => (
            <ActivityCard key={item.id} item={item} showAuthor={false} />
          ))}
          {activities.length === 0 ? <Card className="p-4 text-[13px] text-muted">Nenhuma atividade publicada.</Card> : null}
        </div>
      </section>

      <section className="mt-6">
        <p className="mb-2 text-[14px] font-semibold uppercase tracking-[0.16em] text-muted">Explorar</p>
        <ProfileMenu />
      </section>

      {isSelf ? (
        <div className="mt-6">
          <LogoutButton />
        </div>
      ) : null}

      <p className="mt-6 text-center text-[11px] text-muted">
        Atleta desde {timeAgo(user.createdAt)} atrás · dados gravados com GPS real
      </p>
    </>
  );
}

function Cell({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted">{label}</p>
      <p className="tabular text-[14px] font-semibold" style={accent ? { color: accent } : undefined}>
        {value}
      </p>
    </div>
  );
}

function categoryOf(sport: string): SportCategory {
  if (sport.startsWith("ride") || sport === "mtb" || sport === "gravel" || sport === "ebike") return "ride";
  if (sport.startsWith("walk") || sport === "hike") return "walk";
  return "run";
}
