import Image from "next/image";
import Link from "next/link";
import { listActivities } from "@/lib/queries";
import { territories } from "@/lib/gamification";
import { SPORTS, getSport } from "@/lib/sports";
import { fmtKm } from "@/lib/format";
import Icon from "@/components/Icon";
import Logo from "@/components/Logo";
import Reveal from "@/components/Reveal";
import hero from "../../../public/img/trail.jpg";
import track from "../../../public/img/track.jpg";
import road from "../../../public/img/road.jpg";
import mtb from "../../../public/img/mtb.jpg";
import community from "../../../public/img/community.jpg";
import dawn from "../../../public/img/dawn.jpg";

export const dynamic = "force-dynamic";

const LANDING_GROUPS = [
  { n: "01", title: "Corrida", copy: "Do primeiro quilômetro à maratona. Pace, parciais e recordes em cada passada.", keys: ["run", "street_run", "trail_run"], img: dawn },
  { n: "02", title: "Caminhada", copy: "Ritmo próprio, caminhos novos. De passeios pela cidade a travessias de montanha.", keys: ["walk", "leisure_walk", "long_walk", "hike"], labels: { walk: "Caminhada", leisure_walk: "Caminhada recreativa", long_walk: "Longa distância", hike: "Hiking" } as Record<string, string>, img: hero },
  { n: "03", title: "Ciclismo", copy: "Velocidade, altimetria e pausa automática. Feito para quem vive sobre duas rodas.", keys: ["road_bike", "mtb", "gravel", "urban_bike", "ebike"], img: road },
];

export default async function Landing() {
  const all = await listActivities().catch(() => []);
  const km = all.reduce((s, a) => s + a.distanceM, 0);
  const terr = territories(all);
  const recent = all.filter((a) => a.status === "published").slice(0, 3);

  return (
    <div className="bg-ink relative w-full overflow-x-clip">
      <header className="absolute top-0 inset-x-0 z-20 px-5 flex items-center justify-between" style={{ paddingTop: "env(safe-area-inset-top)", height: "calc(3.5rem + env(safe-area-inset-top))" }}>
        <Logo className="h-[18px] text-bone" />
        <Link href="/" className="tap text-[13px] font-medium text-bone/85">Entrar</Link>
      </header>
      {/* ───────── HERO ───────── */}
      <section className="relative min-h-[100svh] flex flex-col overflow-hidden [container-type:inline-size]">
        <div className="absolute inset-0">
          <Image src={hero} alt="Atleta de trail running em descida na montanha" fill priority placeholder="blur" sizes="100vw" className="kb object-cover object-[62%_center] " />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(16,17,18,.82)_0%,rgba(16,17,18,.35)_45%,rgba(16,17,18,0)_70%)] hidden " />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(16,17,18,.15)_0%,rgba(16,17,18,0)_30%,rgba(16,17,18,.92)_78%,#101112_100%)]" />
        </div>

        <div className="relative flex-1 w-full min-w-0 px-5 flex flex-col justify-end pt-28 pb-10">
          <div className="w-full min-w-0 max-w-[640px]">
            <div className="rise flex items-center gap-3 eyebrow !text-bone/80" style={{ animationDelay: "150ms" }}>
              <span className="w-6 h-px bg-lime" />Corrida · Pedal · Trilha
            </div>
            <h1 className="rise display text-[clamp(38px,13cqw,76px)] mt-5 text-bone max-w-full" style={{ animationDelay: "250ms" }}>
              Seu<br />movimento.
            </h1>
            <h2 className="rise display text-[clamp(26px,8.6cqw,44px)] mt-2 text-lime max-w-full whitespace-nowrap" style={{ animationDelay: "380ms" }}>Seu território.</h2>
            <p className="rise mt-6 text-[15px] leading-relaxed text-bone/80 max-w-[440px]" style={{ animationDelay: "500ms" }}>
              Registre suas atividades. Explore novos caminhos. Descubra desafios e supere seus limites.
            </p>
            <div className="rise mt-8 flex flex-col gap-3 w-full" style={{ animationDelay: "620ms" }}>
              <Link href="/record" className="tap btn btn-lime group w-full !h-[52px]">Começar agora <Icon name="arrow" size={16} className="transition-transform group-hover:translate-x-1" /></Link>
              <Link href="/" className="tap btn btn-ghost w-full !h-[52px]">Já tenho uma conta</Link>
            </div>
          </div>
        </div>

        <div className="relative border-t border-bone/10">
          <div className="px-5 grid grid-cols-3 divide-x divide-bone/10">
            {[[String(all.length), "atividades registradas"], [fmtKm(km, 0), "quilômetros percorridos"], [String(terr), "territórios conquistados"]].map(([v, l]) => (
              <div key={l} className="min-w-0 py-5 px-3 first:pl-0 last:pr-0">
                <div className="num text-2xl  text-bone">{v}</div>
                <div className="text-[10px] text-mute mt-1 uppercase tracking-[.1em] leading-snug [overflow-wrap:break-word]">{l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───────── MODALIDADES ───────── */}
      <section className="w-full px-5 py-20">
        <Reveal className="flex flex-col gap-4 mb-10">
          <div className="min-w-0">
            <div className="eyebrow">Modalidades</div>
            <h2 className="display text-[clamp(32px,10vw,48px)] mt-4 min-w-0">Um app.<br />Todo terreno.</h2>
          </div>
          <p className="text-mute leading-relaxed text-[15px] max-w-[46ch]">Cada modalidade tem métricas próprias, recordes próprios e uma tela de gravação desenhada para ela.</p>
        </Reveal>

        <div className="border-t border-line">
          {LANDING_GROUPS.map((g, gi) => (
            <Reveal key={g.n} delay={gi * 80}>
              <div className="group flex flex-col gap-5 py-8 border-b border-line">
                <div className="min-w-0">
                  <div className="flex items-baseline gap-3">
                    <span className="num text-mute text-sm shrink-0">{g.n}</span>
                    <h3 className="display text-[clamp(30px,9vw,40px)] min-w-0 transition-colors duration-500 group-hover:text-lime">{g.title}</h3>
                  </div>
                  <p className="text-mute mt-3 leading-relaxed text-[15px]">{g.copy}</p>
                </div>
                <ul className="w-full min-w-0 border-t border-line/70">
                  {g.keys.map((k) => (
                    <li key={k}>
                      <Link href="/record" className="tap grid grid-cols-[24px_minmax(0,1fr)_16px] items-center gap-4 min-h-[52px] py-3 border-b border-line/70 last:border-0 text-bone/85 hover:text-bone transition-colors group/i">
                        <Icon name={k} size={24} className="shrink-0 text-mute group-hover/i:text-lime transition-colors" />
                        <span className="min-w-0 text-[15px] leading-snug">{g.labels?.[k] ?? getSport(k).label}</span>
                        <Icon name="arrow" size={16} className="shrink-0 justify-self-end opacity-0 -translate-x-2 group-hover/i:opacity-100 group-hover/i:translate-x-0 transition-all duration-300 text-lime" />
                      </Link>
                    </li>
                  ))}
                </ul>
                <div className="hidden   relative aspect-[4/5] overflow-hidden">
                  <Image src={g.img} alt="" fill sizes="25vw" className="object-cover grayscale group-hover:grayscale-0 scale-105 group-hover:scale-100 transition-all duration-[1.2s] ease-out-expo" />
                </div>
              </div>
            </Reveal>
          ))}
        </div>
        <p className="mt-8 text-xs text-mute tracking-wide">Em breve: {SPORTS.filter((s) => !s.enabled).map((s) => s.label).join(" · ")}</p>
      </section>

      {/* ───────── GPS ───────── */}
      <section className="bg-graphite">
        <div className="mx-auto grid ">
          <div className="relative min-h-[420px]  overflow-hidden">
            <Image src={track} alt="Corredor em pista ao entardecer" fill sizes="(min-width:1024px) 50vw, 100vw" className="object-cover" />
            <div className="absolute inset-0 bg-ink/35" />
            {/* leitura ao vivo — composição tipográfica */}
            <div className="absolute left-5 right-5 bottom-5     bg-ink/85 backdrop-blur-sm border border-line">
              <div className="flex items-center justify-between px-5 pt-4 eyebrow"><span className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-lime animate-pulse" />Gravando</span><span>GPS ±4 m</span></div>
              <div className="px-5 py-4 num text-7xl text-bone">5:12<span className="text-base text-mute ml-2 font-sans font-medium tracking-normal">/km</span></div>
              <div className="grid grid-cols-3 border-t border-line divide-x divide-line text-center">
                {[["8.42", "km"], ["43:51", "tempo"], ["126", "m ↑"]].map(([v, l]) => <div key={l} className="py-3"><div className="num text-lg">{v}</div><div className="text-[10px] text-mute uppercase tracking-widest">{l}</div></div>)}
              </div>
            </div>
          </div>
          <div className="px-5  py-20  flex flex-col justify-center">
            <Reveal>
              <div className="eyebrow">Registro GPS</div>
              <h2 className="display text-[clamp(32px,10vw,48px)] mt-4 min-w-0">Cada metro<br />conta.</h2>
              <p className="text-mute mt-6 max-w-md leading-relaxed">Rastreamento por GPS real, com filtro de precisão e descarte automático de saltos de sinal. Números grandes, legíveis em movimento.</p>
            </Reveal>
            <dl className="mt-12 grid grid-cols-2 gap-px bg-line border border-line">
              {[["Pausa automática", "Detecta quando você para e retoma sozinha."], ["Altimetria", "Elevação acumulada e perfil do percurso."], ["Parciais por km", "Pace e velocidade em cada trecho."], ["Recuperação", "Atividade salva mesmo se o app fechar."]].map(([t, d], i) => (
                <Reveal key={t} delay={i * 70} className="bg-graphite p-5 ">
                  <dt className="font-semibold text-[15px]">{t}</dt>
                  <dd className="text-mute text-sm mt-2 leading-relaxed">{d}</dd>
                </Reveal>
              ))}
            </dl>
            <Link href="/record" className="btn btn-lime self-start mt-10">Gravar atividade</Link>
          </div>
        </div>
      </section>

      {/* ───────── EXPLORAÇÃO E DESAFIOS ───────── */}
      <section className="relative overflow-hidden">
        <div className="relative h-[78vh] min-h-[520px]">
          <Image src={road} alt="Ciclistas subindo estrada de montanha" fill sizes="100vw" className="object-cover" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,#101112_0%,rgba(16,17,18,.2)_25%,rgba(16,17,18,.25)_60%,#101112_100%)]" />
          <svg className="absolute inset-0 w-full h-full opacity-60 mix-blend-screen" preserveAspectRatio="none" aria-hidden>
            <defs><pattern id="g" width="56" height="56" patternUnits="userSpaceOnUse"><path d="M56 0H0v56" fill="none" stroke="rgba(245,245,242,.09)" /></pattern></defs>
            <rect width="100%" height="100%" fill="url(#g)" />
          </svg>
          <div className="absolute top-[38%] left-[58%] w-[112px] h-[56px] border border-lime bg-lime/15 hidden " />
          <div className="absolute top-[38%] left-[58%] -translate-y-full hidden  eyebrow !text-lime pb-2">Território conquistado</div>
          <div className="relative h-full mx-auto px-5  flex flex-col justify-end pb-16">
            <Reveal className="max-w-xl">
              <div className="eyebrow !text-bone/70">Exploração</div>
              <h2 className="display text-[clamp(32px,10vw,48px)] mt-4 min-w-0">Explore.<br />Conquiste.</h2>
              <p className="text-bone/75 mt-6 leading-relaxed max-w-md">Cada área que você percorre vira território seu. Abra novos caminhos e veja seu mapa crescer a cada saída.</p>
            </Reveal>
          </div>
        </div>
        <div className="mx-auto px-5  pb-24 ">
          <div className="grid  border-t border-line">
            {[["Desafios mensais", "Distância, elevação e constância. Metas novas todo mês.", "target"], ["Recompensas", "Complete desafios e desbloqueie medalhas exclusivas.", "medal"], ["Recordes pessoais", "Mais longa, mais rápida, mais alta — sempre visíveis.", "trophy"]].map(([t, d, ic], i) => (
              <Reveal key={t} delay={i * 90} className="py-10  border-b   last:border-0 border-line ">
                <Icon name={ic} size={28} className="text-lime" />
                <h3 className="text-xl font-semibold mt-6">{t}</h3>
                <p className="text-mute mt-2 leading-relaxed text-[15px]">{d}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ───────── CONQUISTAS E EVOLUÇÃO (seção clara) ───────── */}
      <section className="bg-bone text-ink">
        <div className="mx-auto px-5  py-24  grid  gap-14">
          <Reveal className="">
            <div className="eyebrow !text-ink/50">Evolução</div>
            <h2 className="display text-[clamp(32px,10vw,48px)] mt-4 min-w-0">Mais longe<br />que ontem.</h2>
            <p className="text-ink/60 mt-6 leading-relaxed max-w-md">Acompanhe sua progressão semana após semana. Compare atividades lado a lado e veja exatamente onde você evoluiu.</p>
            <Link href="/profile" className="mt-10 inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-wider link-u">Ver meu perfil <Icon name="arrow" size={16} /></Link>
          </Reveal>
          <div className=" ">
            <Reveal className="border-t-2 border-ink">
              {[["Primeiros 5 km", "Corrida", "run"], ["Pedal de 100 km", "Ciclismo", "road_bike"], ["1.000 m de elevação", "Montanha", "mountain"], ["25 territórios", "Exploração", "pin"]].map(([t, c, ic], i) => (
                <div key={t} className="group flex items-center gap-5  py-6 border-b border-ink/15">
                  <span className="num text-sm text-ink/40 w-6">{String(i + 1).padStart(2, "0")}</span>
                  <span className="w-12 h-12 flex items-center justify-center bg-ink text-lime transition-transform duration-500 group-hover:-rotate-6"><Icon name={ic} size={22} /></span>
                  <span className="flex-1"><span className="block text-lg  font-semibold">{t}</span><span className="text-ink/50 text-sm">{c}</span></span>
                  <Icon name="medal" size={22} className="text-ink/30 group-hover:text-ink transition-colors" />
                </div>
              ))}
            </Reveal>
          </div>
        </div>
      </section>

      {/* ───────── COMUNIDADE ───────── */}
      <section className="mx-auto px-5  py-24 ">
        <div className="grid  gap-10  items-center">
          <Reveal className=" relative aspect-[4/3]  overflow-hidden">
            <Image src={community} alt="Grupo de corredores na cidade" fill sizes="(min-width:1024px) 58vw, 100vw" className="object-cover" />
          </Reveal>
          <div className="">
            <Reveal>
              <div className="eyebrow">Comunidade</div>
              <h2 className="display text-[clamp(32px,10vw,48px)] mt-4 min-w-0">Ninguém<br />corre só.</h2>
              <p className="text-mute mt-6 leading-relaxed">Publique seus treinos com fotos, mapa e números. Dê kudos, comente e acompanhe quem se move com você.</p>
            </Reveal>
            <div className="mt-10 border-t border-line">
              {recent.length > 0 ? recent.map((a) => (
                <Link key={a.id} href={`/activities/${a.id}`} className="flex items-center gap-4 py-4 border-b border-line group">
                  <Icon name={a.sport} size={22} className="text-mute group-hover:text-lime transition-colors" />
                  <span className="flex-1 truncate">{a.title}</span>
                  <span className="num text-sm text-mute">{fmtKm(a.distanceM)} km</span>
                </Link>
              )) : (
                <p className="py-5 text-mute text-sm border-b border-line">Seja o primeiro a publicar uma atividade.</p>
              )}
            </div>
            <Link href="/feed" className="mt-8 inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-wider link-u">Abrir o feed <Icon name="arrow" size={16} /></Link>
          </div>
        </div>
      </section>

      {/* ───────── CTA FINAL ───────── */}
      <section className="relative overflow-hidden">
        <div className="relative min-h-[80vh] flex items-center">
          <Image src={mtb} alt="Ciclista em trilha de montanha com picos nevados" fill sizes="100vw" className="object-cover" />
          <div className="absolute inset-0 bg-ink/55" />
          <div className="relative mx-auto w-full px-5  text-center">
            <Reveal>
              <h2 className="display text-[clamp(48px,16vw,64px)] text-bone">Bora<br /><span className="text-lime">muvar.</span></h2>
              <p className="text-bone/80 mt-6 max-w-md mx-auto">A próxima rota começa com um toque.</p>
              <div className="mt-9 flex justify-center flex-wrap gap-3">
                <Link href="/record" className="btn btn-lime">Começar agora</Link>
                <Link href="/" className="btn btn-ghost">Já tenho uma conta</Link>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ───────── FOOTER ───────── */}
      <footer className="border-t border-line">
        <div className="mx-auto px-5  py-12 flex flex-col  gap-8  justify-between">
          <Logo className="h-5 text-bone" />
          <nav className="flex flex-wrap gap-x-8 gap-y-3 text-sm text-mute">
            <Link href="/feed" className="hover:text-bone transition-colors">Feed</Link>
            <Link href="/record" className="hover:text-bone transition-colors">Gravar</Link>
            <Link href="/activities" className="hover:text-bone transition-colors">Atividades</Link>
            <Link href="/profile" className="hover:text-bone transition-colors">Perfil</Link>
          </nav>
          <p className="text-xs text-mute">© {new Date().getFullYear()} MUV. Fotos: Pexels. Mapas: © OpenStreetMap.</p>
        </div>
      </footer>
    </div>
  );
}
