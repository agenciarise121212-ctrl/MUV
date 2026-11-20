import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { IconChevron, IconRoute, IconTrophy, Logo, LogoMark, SportIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

const HERO_IMG =
  "https://images.pexels.com/photos/33874841/pexels-photo-33874841.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=1200&w=1800";
const RIDE_IMG =
  "https://images.pexels.com/photos/5687486/pexels-photo-5687486.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=900&w=1400";
const TRAIL_IMG =
  "https://images.pexels.com/photos/13158581/pexels-photo-13158581.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=900&w=1200";
const HIKE_IMG =
  "https://images.pexels.com/photos/20869809/pexels-photo-20869809.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=1100&w=800";
const STREET_IMG =
  "https://images.pexels.com/photos/33995258/pexels-photo-33995258.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=900&w=1200";
const GROUP_IMG =
  "https://images.pexels.com/photos/12918263/pexels-photo-12918263.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=900&w=1400";

const DISCIPLINES = [
  {
    group: "Corrida",
    code: "01",
    blurb: "Do primeiro quilômetro ao longão. Ritmo, cadência e splits por quilômetro.",
    items: [
      { key: "run", label: "Corrida" },
      { key: "run_street", label: "Corrida de rua" },
      { key: "run_trail", label: "Trail running" },
    ],
  },
  {
    group: "Caminhada",
    code: "02",
    blurb: "Caminhadas curtas, recreativas e de longa distância com altimetria real.",
    items: [
      { key: "walk", label: "Caminhada" },
      { key: "walk_rec", label: "Caminhada recreativa" },
      { key: "walk_long", label: "Longa distância" },
      { key: "hike", label: "Hiking" },
    ],
  },
  {
    group: "Ciclismo",
    code: "03",
    blurb: "Velocidade instantânea, média e máxima, altimetria e pausa automática.",
    items: [
      { key: "ride", label: "Estrada" },
      { key: "mtb", label: "Mountain bike" },
      { key: "gravel", label: "Gravel" },
      { key: "ride_urban", label: "Ciclismo urbano" },
      { key: "ebike", label: "Bicicleta elétrica" },
    ],
  },
];

const GPS_METRICS = [
  { label: "Distância", value: "12,48", unit: "km" },
  { label: "Pace médio", value: "4:38", unit: "/km" },
  { label: "Ganho", value: "312", unit: "m" },
  { label: "Precisão", value: "±4", unit: "m" },
];

const TERRITORIES = [
  { name: "Ibirapuera", region: "São Paulo" },
  { name: "Serra da Cantareira", region: "Norte" },
  { name: "Villa-Lobos", region: "Oeste" },
  { name: "Represa Billings", region: "ABC" },
  { name: "Parque do Carmo", region: "Leste" },
];

function SectionRule({ index, label }: { index: string; label: string }) {
  return (
    <div className="mb-8 flex items-center gap-4">
      <span className="metric text-[11px] font-bold text-lime">{index}</span>
      <span className="h-px flex-1 bg-line" />
      <span className="eyebrow">{label}</span>
    </div>
  );
}

export default async function LandingPage() {
  const user = await getCurrentUser();
  if (user) redirect("/app");

  return (
    <div className="min-h-screen bg-ink">
      {/* Header */}
      <header className="fixed inset-x-0 top-0 z-40 border-b border-line/70 bg-ink/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4 sm:px-5 lg:px-8">
          <Link href="/" className="flex items-center gap-2">
            <LogoMark className="size-5" />
            <span className="font-display text-[15px] font-black uppercase tracking-[0.2em]">MUV</span>
          </Link>
          <nav className="hidden items-center gap-8 md:flex">
            {[
              ["Modalidades", "#modalidades"],
              ["Registro", "#registro"],
              ["Territórios", "#territorios"],
              ["Comunidade", "#comunidade"],
            ].map(([label, href]) => (
              <a key={href} href={href} className="text-[11px] font-display font-bold uppercase tracking-[0.16em] text-muted transition-colors hover:text-paper">
                {label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/entrar?mode=login" className="hidden text-[11px] font-display font-bold uppercase tracking-[0.16em] text-muted transition-colors hover:text-paper sm:block">
              Entrar
            </Link>
            <Link href="/entrar" className="btn btn-primary">
              Criar conta
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative min-h-[92svh] overflow-x-clip overflow-y-hidden pt-14">
        <div className="absolute inset-0">
          <Image
            src={HERO_IMG}
            alt="Atleta correndo em trilha de montanha ao amanhecer"
            fill
            priority
            sizes="(max-width: 768px) 100vw, 100vw"
            className="photo object-cover object-[62%_center]"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink/72 to-ink/15" />
          <div className="absolute inset-0 bg-gradient-to-t from-ink via-transparent to-ink/45" />
        </div>

        <div className="relative mx-auto flex min-h-[calc(92svh-3.5rem)] w-full max-w-6xl flex-col justify-end px-4 pb-12 sm:px-5 lg:px-8 lg:pb-20">
          <div className="w-full min-w-0 max-w-3xl">
            <div className="mb-5 flex items-center gap-3 sm:mb-6">
              <span className="tick h-6 shrink-0" />
              <p className="eyebrow min-w-0 text-paper/70">Plataforma esportiva social</p>
            </div>
            <h1 className="display-1 text-[clamp(1.7rem,8.5vw,6.5rem)]">
              Seu movimento.
              <br />
              <span className="text-lime">Seu território.</span>
            </h1>
            <p className="mt-6 w-full max-w-xl min-w-0 text-[15px] leading-relaxed text-paper/75 sm:mt-7 lg:text-base">
              Registre suas atividades. Explore novos caminhos. Descubra desafios e supere seus limites.
            </p>
            <div className="mt-8 grid w-full grid-cols-1 gap-3 sm:mt-9 sm:flex sm:flex-wrap sm:gap-3">
              <Link href="/entrar" className="btn btn-primary w-full px-8 py-3.5 text-[13px] sm:w-auto">
                Começar agora
              </Link>
              <Link href="/entrar?mode=login" className="btn btn-ghost w-full px-8 py-3.5 text-[13px] sm:w-auto">
                Já tenho uma conta
              </Link>
            </div>
          </div>

          <div className="mt-12 grid w-full max-w-2xl grid-cols-2 gap-x-6 gap-y-5 border-t border-paper/15 pt-6 sm:mt-14 sm:grid-cols-4 sm:gap-x-8">
            {GPS_METRICS.map((m) => (
              <div key={m.label}>
                <p className="metric text-2xl font-black leading-none">
                  {m.value}
                  <span className="ml-1 text-[11px] font-semibold text-muted">{m.unit}</span>
                </p>
                <p className="mt-1.5 text-[9px] font-display font-bold uppercase tracking-[0.18em] text-muted">{m.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Manifesto */}
      <section className="border-y border-line bg-graphite">
        <div className="overflow-hidden py-3">
          <div className="ticker flex w-max gap-10 whitespace-nowrap">
            {Array.from({ length: 2 }).map((_, dup) => (
              <div key={dup} className="flex gap-10">
                {["Corrida", "Trail", "Caminhada", "Hiking", "Estrada", "Mountain bike", "Gravel", "Urbano", "e-Bike"].map((w) => (
                  <span key={`${dup}-${w}`} className="font-display text-[12px] font-bold uppercase tracking-[0.28em] text-muted">
                    {w} <span className="ml-6 text-lime">/</span>
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Modalidades */}
      <section id="modalidades" className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-5 sm:py-20 lg:px-8 lg:py-28">
        <SectionRule index="01" label="Modalidades" />
        <div className="grid w-full min-w-0 gap-12 lg:grid-cols-[1fr_1.35fr] lg:gap-16">
          <div className="min-w-0">
            <h2 className="display-1 text-[clamp(1.6rem,7.5vw,3.4rem)]">
              Um app,
              <br />
              três mundos
            </h2>
            <p className="mt-6 w-full max-w-md min-w-0 text-[15px] leading-relaxed text-muted">
              Cada modalidade tem métricas próprias, fórmulas de calorias e limiares de pausa automática. O MUV trata ciclismo,
              corrida e caminhada como disciplinas distintas — não como variações de uma mesma tela.
            </p>
          </div>

          <div className="min-w-0 divide-y divide-line border-y border-line">
            {DISCIPLINES.map((d) => (
              <div key={d.group} className="group min-w-0 py-6 sm:py-7">
                <div className="flex min-w-0 items-baseline gap-3 sm:gap-4">
                  <span className="metric shrink-0 text-[11px] font-bold text-lime">{d.code}</span>
                  <h3 className="display-2 min-w-0 text-[19px] sm:text-[20px]">{d.group}</h3>
                </div>
                <p className="mt-3 w-full max-w-lg min-w-0 text-[13px] leading-relaxed text-muted">{d.blurb}</p>
                <ul className="mt-5 grid w-full min-w-0 grid-cols-1 gap-x-6 gap-y-3.5 sm:mt-6 sm:grid-cols-2 sm:gap-y-4">
                  {d.items.map((item) => (
                    <li key={item.key} className="flex w-full min-w-0 items-center gap-3">
                      <SportIcon
                        sport={item.key}
                        className="size-6 shrink-0 text-paper transition-colors group-hover:text-lime"
                      />
                      <span className="min-w-0 flex-1 text-[13px] font-medium leading-snug">{item.label}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-16 grid w-full min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { src: STREET_IMG, alt: "Corredor em movimento na cidade", caption: "Corrida de rua" },
            { src: TRAIL_IMG, alt: "Atleta em trilha técnica", caption: "Trail running" },
            { src: RIDE_IMG, alt: "Ciclista em estrada de montanha", caption: "Ciclismo de estrada" },
            { src: HIKE_IMG, alt: "Caminhante em crista de montanha", caption: "Hiking" },
          ].map((img) => (
            <figure key={img.caption} className="group relative overflow-hidden border border-line">
              <div className="relative aspect-[4/5]">
                <Image src={img.src} alt={img.alt} fill sizes="(max-width: 768px) 100vw, 25vw" className="photo-duotone object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
              </div>
              <figcaption className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-ink to-transparent px-4 pb-3 pt-10">
                <span className="font-display text-[11px] font-bold uppercase tracking-[0.18em]">{img.caption}</span>
                <IconChevron className="size-3 text-lime" />
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* Registro */}
      <section id="registro" className="border-y border-line bg-graphite">
        <div className="mx-auto grid w-full max-w-6xl min-w-0 gap-12 px-4 py-16 sm:px-5 sm:py-20 lg:grid-cols-2 lg:items-center lg:gap-20 lg:px-8 lg:py-28">
          <div>
            <SectionRule index="02" label="Registro" />
            <h2 className="display-1 text-[clamp(1.6rem,7.5vw,3.4rem)]">
              GPS real.
              <br />
              Nada simulado.
            </h2>
            <p className="mt-6 max-w-md text-[15px] leading-relaxed text-muted">
              Cada amostra captura latitude, longitude, altitude, velocidade e precisão em metros. Pontos com sinal fraco são
              descartados, não inventados.
            </p>
            <ul className="mt-9 space-y-5">
              {[
                ["Início, pausa e retomada", "Cronômetro separa tempo total de tempo em movimento, com pausa automática em semáforos."],
                ["Altimetria acumulada", "Ganho e perda calculados com histerese para ignorar ruído do barômetro."],
                ["Splits por quilômetro", "Ritmo de cada trecho, com melhor volta destacada na comparação entre atividades."],
                ["Recordes pessoais", "Ciclismo e corrida ganham PRs por distância, velocidade média e subida."],
              ].map(([title, body]) => (
                <li key={title} className="flex gap-4">
                  <span className="tick mt-1 h-[calc(100%-8px)] shrink-0" />
                  <div>
                    <p className="font-display text-[13px] font-bold uppercase tracking-[0.1em]">{title}</p>
                    <p className="mt-1 text-[13px] leading-relaxed text-muted">{body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="relative">
            <div className="relative aspect-[4/5] overflow-hidden border border-line sm:aspect-[3/4]">
              <Image src={RIDE_IMG} alt="Ciclista pedalando em estrada asfaltada" fill sizes="(max-width: 1024px) 100vw, 50vw" className="photo object-cover" />
            </div>
            <div className="absolute -bottom-6 -left-2 w-[220px] border border-line bg-ink p-5 lg:-left-10 lg:w-[260px]">
              <p className="eyebrow">Ao vivo</p>
              <div className="mt-3 flex items-end gap-1.5">
                <p className="metric text-4xl font-black leading-none text-lime">31,4</p>
                <p className="pb-1 text-[11px] font-semibold text-muted">km/h</p>
              </div>
              <div className="mt-4 space-y-2 border-t border-line pt-3">
                {[
                  ["Distância", "42,18 km"],
                  ["Movimento", "1:24:07"],
                  ["Ganho", "612 m"],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between">
                    <span className="text-[10px] uppercase tracking-[0.14em] text-muted">{k}</span>
                    <span className="metric text-[12px] font-bold">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Territórios e desafios */}
      <section id="territorios" className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-5 sm:py-20 lg:px-8 lg:py-28">
        <SectionRule index="03" label="Exploração" />
        <div className="grid w-full min-w-0 gap-12 lg:grid-cols-[1.2fr_1fr] lg:gap-20">
          <div>
            <h2 className="display-1 text-[clamp(1.6rem,7.5vw,3.4rem)]">
              Domine
              <br />
              o mapa
            </h2>
            <p className="mt-6 max-w-lg text-[15px] leading-relaxed text-muted">
              Territórios são regiões reais da cidade. Percorra pelo menos 250 metros dentro de uma área para conquistá-la — e
              manter seu nome nela até que outro atleta faça melhor.
            </p>
            <ul className="mt-9 grid gap-px border border-line bg-line sm:grid-cols-2">
              {TERRITORIES.map((t) => (
                <li key={t.name} className="flex items-center justify-between bg-ink px-4 py-3.5">
                  <span className="text-[13px] font-medium">{t.name}</span>
                  <span className="text-[9px] font-display font-bold uppercase tracking-[0.16em] text-muted">{t.region}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="w-full min-w-0 space-y-4">
            <div className="surface p-6">
              <div className="flex items-center justify-between">
                <p className="eyebrow">Desafios</p>
                <IconTrophy className="size-5 text-lime" />
              </div>
              <p className="display-2 mt-4 text-[17px]">100 km de pedal</p>
              <div className="mt-4 h-[3px] w-full bg-graphite-2">
                <div className="h-full w-[72%] bg-lime" />
              </div>
              <div className="mt-2 flex justify-between text-[11px] text-muted">
                <span className="metric">72 / 100 km</span>
                <span>12 dias restantes</span>
              </div>
            </div>
            <div className="surface p-6">
              <div className="flex items-center justify-between">
                <p className="eyebrow">Segmentos</p>
                <IconRoute className="size-5 text-lime" />
              </div>
              <p className="display-2 mt-4 text-[17px]">Reta do Rio Pinheiros</p>
              <p className="mt-2 text-[13px] text-muted">Trecho plano de 4,2 km. Todo treino compatível entra no ranking automaticamente.</p>
              <div className="mt-4 border-t border-line pt-4">
                {[
                  ["1", "Ana S.", "6:12"],
                  ["2", "Bruno L.", "6:28"],
                  ["3", "Carla D.", "6:41"],
                ].map(([pos, name, time]) => (
                  <div key={pos} className="flex items-center justify-between py-1.5">
                    <span className="flex items-center gap-3">
                      <span className={`metric w-4 text-[11px] font-bold ${pos === "1" ? "text-lime" : "text-muted"}`}>{pos}</span>
                      <span className="text-[13px]">{name}</span>
                    </span>
                    <span className="metric text-[12px] font-bold">{time}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Conquistas */}
      <section className="border-y border-line bg-graphite">
        <div className="mx-auto grid w-full max-w-6xl min-w-0 gap-12 px-4 py-16 sm:px-5 sm:py-20 lg:grid-cols-[1fr_1.1fr] lg:items-center lg:gap-20 lg:px-8 lg:py-28">
          <div className="relative order-2 lg:order-1">
            <div className="relative aspect-[5/4] overflow-hidden border border-line">
              <Image src={HIKE_IMG} alt="Atleta caminhando em trilha de montanha" fill sizes="(max-width: 1024px) 100vw, 50vw" className="photo object-cover" />
            </div>
          </div>
          <div className="order-1 lg:order-2">
            <SectionRule index="04" label="Evolução" />
            <h2 className="display-1 text-[clamp(1.6rem,7.5vw,3.4rem)]">
              Progresso
              <br />
              que se vê
            </h2>
            <p className="mt-6 max-w-md text-[15px] leading-relaxed text-muted">
              XP, níveis, conquistas e moedas. Cada quilômetro real registrado alimenta sua evolução — e moedas viram recompensas
              de parceiros esportivos.
            </p>
            <div className="mt-9 grid gap-px border border-line bg-line sm:grid-cols-3">
              {[
                ["Nível 5", "Alfa"],
                ["1.840", "XP acumulado"],
                ["24 / 37", "Conquistas"],
              ].map(([value, label]) => (
                <div key={label} className="bg-ink px-4 py-5">
                  <p className="metric text-xl font-black text-lime">{value}</p>
                  <p className="mt-1 text-[9px] font-display font-bold uppercase tracking-[0.16em] text-muted">{label}</p>
                </div>
              ))}
            </div>
            <div className="mt-8 flex flex-wrap gap-2">
              {["Primeiro pedal", "Cume alcançado", "Semana perfeita", "Rei do segmento", "Cartógrafo"].map((a) => (
                <span key={a} className="border border-line px-3 py-1.5 text-[10px] font-display font-bold uppercase tracking-[0.14em] text-muted">
                  {a}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Comunidade */}
      <section id="comunidade" className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-5 sm:py-20 lg:px-8 lg:py-28">
        <SectionRule index="05" label="Comunidade" />
        <div className="grid w-full min-w-0 gap-12 lg:grid-cols-2 lg:items-center lg:gap-20">
          <div>
            <h2 className="display-1 text-[clamp(1.6rem,7.5vw,3.4rem)]">
              Treino é
              <br />
              coletivo
            </h2>
            <p className="mt-6 max-w-md text-[15px] leading-relaxed text-muted">
              Publique atividades com fotos, receba kudos, comente trajetos e siga atletas que treinam como você. O feed mostra o
              que a sua comunidade fez nas últimas horas.
            </p>
            <Link href="/entrar" className="btn btn-primary mt-8">
              Entrar para a comunidade
            </Link>
          </div>
          <div className="grid w-full min-w-0 gap-4 sm:grid-cols-2">
            <div className="relative aspect-[3/4] min-w-0 overflow-hidden border border-line sm:row-span-2">
              <Image src={GROUP_IMG} alt="Grupo de corredores em prova de montanha" fill sizes="(max-width: 1024px) 100vw, 50vw" className="photo object-cover" />
            </div>
            <div className="surface p-5">
              <div className="flex items-center gap-3">
                <span className="grid size-9 place-items-center rounded-full bg-lime font-display text-[12px] font-black text-ink">AS</span>
                <div>
                  <p className="text-[13px] font-semibold">Ana Souza</p>
                  <p className="text-[11px] text-muted">Pedal · Ibirapuera</p>
                </div>
              </div>
              <p className="metric mt-4 text-2xl font-black">28,4<span className="ml-1 text-[11px] font-semibold text-muted">km</span></p>
              <div className="mt-3 flex gap-4 border-t border-line pt-3 text-[11px] text-muted">
                <span className="metric">27,4 km/h</span>
                <span className="metric">1:02:04</span>
              </div>
            </div>
            <div className="surface p-5">
              <div className="flex items-center gap-3">
                <span className="grid size-9 place-items-center rounded-full bg-sky font-display text-[12px] font-black text-ink">BL</span>
                <div>
                  <p className="text-[13px] font-semibold">Bruno Lima</p>
                  <p className="text-[11px] text-muted">Trail · Cantareira</p>
                </div>
              </div>
              <p className="metric mt-4 text-2xl font-black">15,3<span className="ml-1 text-[11px] font-semibold text-muted">km</span></p>
              <div className="mt-3 flex gap-4 border-t border-line pt-3 text-[11px] text-muted">
                <span className="metric">+842 m</span>
                <span className="metric">1:37:52</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="relative overflow-hidden border-t border-line">
        <div className="absolute inset-0">
          <Image src={TRAIL_IMG} alt="Atleta correndo em terreno acidentado" fill sizes="100vw" className="photo-duotone object-cover object-center opacity-55" />
          <div className="absolute inset-0 bg-ink/78" />
        </div>
        <div className="relative mx-auto w-full max-w-6xl px-4 py-20 text-center sm:px-5 sm:py-24 lg:px-8 lg:py-32">
          <LogoMark className="mx-auto size-9" />
          <h2 className="display-1 mx-auto mt-8 max-w-3xl text-[clamp(1.9rem,9vw,4.5rem)]">
            Comece onde
            <br />
            você está
          </h2>
          <p className="mx-auto mt-6 max-w-lg text-[15px] leading-relaxed text-paper/70">
            Crie sua conta, grave a primeira atividade e descubra quais territórios já estão no seu alcance.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Link href="/entrar" className="btn btn-primary px-8 py-3.5 text-[13px]">
              Criar conta
            </Link>
            <Link href="/entrar?mode=login" className="btn btn-ghost px-8 py-3.5 text-[13px]">
              Já tenho uma conta
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-line">
        <div className="mx-auto flex w-full max-w-6xl min-w-0 flex-col gap-6 px-4 py-10 sm:px-5 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <Logo size={18} />
          <nav className="flex flex-wrap gap-x-7 gap-y-2">
            {["Modalidades", "Registro", "Territórios", "Comunidade"].map((l, i) => (
              <a key={l} href={["#modalidades", "#registro", "#territorios", "#comunidade"][i]} className="text-[11px] font-display font-bold uppercase tracking-[0.16em] text-muted transition-colors hover:text-paper">
                {l}
              </a>
            ))}
          </nav>
          <p className="text-[11px] text-muted">
            © {new Date().getFullYear()} MUV · Mapas © OpenStreetMap · CARTO
          </p>
        </div>
      </footer>
    </div>
  );
}
