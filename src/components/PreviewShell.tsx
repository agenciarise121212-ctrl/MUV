"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Icon, LogoMark } from "@/components/icons.client";

type Device = {
  id: string;
  name: string;
  w: number;
  h: number;
  notch: "island" | "classic" | "punch";
  /** Altura da área segura superior simulada. */
  safeTop: number;
};

const DEVICES: Device[] = [
  { id: "iphone-se", name: "iPhone SE · 375×667", w: 375, h: 667, notch: "classic", safeTop: 20 },
  { id: "iphone-15", name: "iPhone 15 · 393×852", w: 393, h: 852, notch: "island", safeTop: 47 },
  { id: "iphone-15-max", name: "iPhone 15 Pro Max · 430×932", w: 430, h: 932, notch: "island", safeTop: 47 },
  { id: "pixel-8", name: "Pixel 8 · 412×915", w: 412, h: 915, notch: "punch", safeTop: 36 },
  { id: "galaxy-s23", name: "Galaxy S23 · 360×780", w: 360, h: 780, notch: "punch", safeTop: 30 },
];

const ROUTES = [
  { href: "/app", label: "Início" },
  { href: "/app/map", label: "Mapa" },
  { href: "/app/missions", label: "Missões" },
  { href: "/app/record", label: "Gravar" },
  { href: "/app/record/ride", label: "Gravar pedal" },
  { href: "/app/activities", label: "Histórico" },
  { href: "/app/challenges", label: "Desafios" },
  { href: "/app/rewards", label: "Recompensas" },
  { href: "/app/profile", label: "Perfil" },
  { href: "/entrar", label: "Entrar / Cadastro" },
  { href: "/", label: "Landing" },
];

const ZOOMS = ["fit", "100%", "75%", "50%"] as const;
type Zoom = (typeof ZOOMS)[number];

const DEMO = { email: "ana@muv.app", password: "muv1234" };

/** Relógio da barra de status simulada. */
function useClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const i = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(i);
  }, []);
  if (!now) return "--:--";
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

export function PreviewShell({ qrSvg, shareUrl }: { qrSvg: string | null; shareUrl: string }) {
  const [deviceId, setDeviceId] = useState(DEVICES[1].id);
  const [zoom, setZoom] = useState<Zoom>("fit");
  const [rotated, setRotated] = useState(false);
  const [bezel, setBezel] = useState(true);
  const [showQr, setShowQr] = useState(false);
  const [src, setSrc] = useState("/app");
  const [nonce, setNonce] = useState(0);
  const [buildId, setBuildId] = useState<string | null>(null);
  const [liveToast, setLiveToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [fitScale, setFitScale] = useState(1);

  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const buildRef = useRef<string | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const clock = useClock();

  const device = useMemo(() => DEVICES.find((d) => d.id === deviceId) ?? DEVICES[1], [deviceId]);
  const screenW = rotated ? device.h : device.w;
  const screenH = rotated ? device.w : device.h;

  /* ------------------------------- Zoom "fit" ------------------------------- */
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const compute = () => {
      const rect = stage.getBoundingClientRect();
      const chromeW = bezel ? 26 : 8;
      const chromeH = bezel ? 26 : 8;
      const availW = Math.max(160, rect.width - chromeW);
      const availH = Math.max(240, rect.height - chromeH);
      const scale = Math.min(1, availW / screenW, availH / screenH);
      setFitScale(Number.isFinite(scale) && scale > 0 ? scale : 1);
    };
    compute();
    const observer = new ResizeObserver(compute);
    observer.observe(stage);
    return () => observer.disconnect();
  }, [screenW, screenH, bezel]);

  const scale = zoom === "fit" ? fitScale : Number(zoom.replace("%", "")) / 100;

  /* --------------------------- Recarga em nova build --------------------------- */
  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const res = await fetch("/api/build-id", { cache: "no-store" });
        const json = (await res.json()) as { id?: string };
        if (!alive || !json.id) return;
        const previous = buildRef.current;
        buildRef.current = json.id;
        if (previous && previous !== json.id) {
          setBuildId(json.id);
          setLiveToast("Nova versão publicada — recarregando…");
          reload();
          window.setTimeout(() => setLiveToast(null), 2600);
        }
      } catch {
        /* rede instável: tenta no próximo ciclo */
      }
    };
    void tick();
    const timer = window.setInterval(tick, 6000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [reload]);

  /* ------------------------------- Ações ------------------------------- */
  async function loginDemo() {
    setBusy(true);
    try {
      await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "login", email: DEMO.email, password: DEMO.password }),
      });
      setSrc("/app");
      reload();
    } finally {
      setBusy(false);
    }
  }

  async function logoutDemo() {
    setBusy(true);
    try {
      await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "logout" }),
      });
      setSrc("/entrar");
      reload();
    } finally {
      setBusy(false);
    }
  }

  const iframeKey = `${src}#${nonce}`;

  return (
    <div className="min-h-screen bg-[#08090a]">
      {/* Barra de controle do simulador */}
      <header className="sticky top-0 z-20 border-b border-line bg-ink/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
          <Link href="/" className="flex shrink-0 items-center gap-2">
            <LogoMark className="size-5" />
            <span className="font-display text-[14px] font-black uppercase tracking-[0.18em]">MUV</span>
          </Link>
          <span className="hidden h-5 w-px bg-line sm:block" />
          <span className="eyebrow shrink-0">Simulador mobile</span>

          <div className="flex flex-1 flex-wrap items-center gap-2">
            <select
              value={deviceId}
              onChange={(e) => setDeviceId(e.target.value)}
              className="field w-auto py-1.5 text-[12px]"
              aria-label="Dispositivo"
            >
              {DEVICES.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>

            <select
              value={zoom}
              onChange={(e) => setZoom(e.target.value as Zoom)}
              className="field w-auto py-1.5 text-[12px]"
              aria-label="Zoom"
            >
              {ZOOMS.map((z) => (
                <option key={z} value={z}>
                  {z === "fit" ? "Ajustar à tela" : z}
                </option>
              ))}
            </select>

            <button type="button" onClick={() => setRotated((v) => !v)} className="btn btn-dark py-1.5 text-[11px]">
              {rotated ? "Retrato" : "Paisagem"}
            </button>
            <button type="button" onClick={() => setBezel((v) => !v)} className="btn btn-dark py-1.5 text-[11px]">
              {bezel ? "Sem moldura" : "Com moldura"}
            </button>
            <button type="button" onClick={reload} className="btn btn-dark py-1.5 text-[11px]">
              Recarregar
            </button>
            <button type="button" onClick={() => void loginDemo()} disabled={busy} className="btn btn-primary py-1.5 text-[11px]">
              Entrar como demo
            </button>
            <button type="button" onClick={() => void logoutDemo()} disabled={busy} className="btn btn-dark py-1.5 text-[11px]">
              Sair
            </button>
            <button type="button" onClick={() => setShowQr((v) => !v)} className="btn btn-dark py-1.5 text-[11px]">
              {showQr ? "Fechar QR" : "QR p/ celular"}
            </button>
          </div>

          <span className="metric shrink-0 text-[10px] font-bold text-muted">
            {screenW}×{screenH} · {Math.round(scale * 100)}%
          </span>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1400px] gap-4 px-4 py-5 lg:flex-row">
        {/* Trilho de rotas */}
        <nav className="hidden w-[168px] shrink-0 lg:block">
          <p className="eyebrow mb-2">Telas</p>
          <ul className="space-y-1">
            {ROUTES.map((r) => (
              <li key={r.href}>
                <button
                  type="button"
                  onClick={() => setSrc(r.href)}
                  className={`w-full border px-3 py-2 text-left text-[12px] font-medium transition-colors ${
                    src === r.href ? "border-lime bg-lime/10 text-lime" : "border-line text-muted hover:border-muted hover:text-paper"
                  }`}
                >
                  {r.label}
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-4 border border-line bg-graphite p-3">
            <p className="eyebrow mb-1.5">Recarga automática</p>
            <p className="text-[11px] leading-relaxed text-muted">
              O simulador verifica a cada 6 s se uma nova versão foi publicada e recarrega sozinho.
            </p>
            <p className="metric mt-2 truncate text-[10px] text-lime">{buildId ?? buildRef.current ?? "verificando…"}</p>
          </div>
        </nav>

        {/* Palco do dispositivo */}
        <div ref={stageRef} className="relative flex min-h-[70vh] flex-1 items-start justify-center overflow-hidden lg:min-h-[calc(100vh-140px)]">
          {liveToast ? (
            <div className="fade absolute left-1/2 top-3 z-30 -translate-x-1/2 border border-lime/45 bg-ink/95 px-3 py-2 text-[11px] font-semibold text-lime backdrop-blur-md">
              {liveToast}
            </div>
          ) : null}

          {showQr ? (
            <div className="absolute inset-0 z-20 grid place-items-center bg-ink/92 px-4 backdrop-blur-sm" onClick={() => setShowQr(false)}>
              <div className="surface max-w-[340px] p-5 text-center" onClick={(e) => e.stopPropagation()}>
                <p className="display-2 text-[15px]">Abra no celular</p>
                <p className="mt-1.5 text-[12px] leading-relaxed text-muted">
                  Escaneie para testar no aparelho real — GPS, câmera e sensores só funcionam de verdade no telefone.
                </p>
                {qrSvg ? (
                  <div
                    className="mx-auto mt-4 w-[200px] [&>svg]:h-auto [&>svg]:w-full"
                    // SVG gerado no servidor a partir da URL do deploy atual.
                    dangerouslySetInnerHTML={{ __html: qrSvg }}
                  />
                ) : (
                  <p className="mt-4 text-[12px] text-muted">QR indisponível neste ambiente.</p>
                )}
                <p className="metric mt-3 break-all text-[10px] text-muted">{shareUrl}</p>
                <button type="button" onClick={() => setShowQr(false)} className="btn btn-dark mt-4 w-full">
                  Fechar
                </button>
              </div>
            </div>
          ) : null}

          <div style={{ width: screenW * scale, height: screenH * scale }} className="relative">
            <div
              style={{
                width: screenW,
                height: screenH,
                transform: `scale(${scale})`,
                transformOrigin: "top left",
              }}
              className={bezel ? "device-shell" : ""}
            >
              <div
                className={bezel ? "device-screen" : ""}
                style={{ width: screenW, height: screenH, display: "flex", flexDirection: "column" }}
              >
                {/* Barra de status simulada — aproxima a área segura superior */}
                {bezel ? (
                  <div className="relative flex shrink-0 items-center justify-between bg-ink px-6" style={{ height: device.safeTop }}>
                    <span className="metric text-[12px] font-semibold text-paper">{clock}</span>
                    {device.notch === "island" ? <span className="device-notch" /> : null}
                    <span className="flex items-center gap-1.5">
                      <IconCheck />
                      <IconWifi />
                      <IconBattery />
                    </span>
                  </div>
                ) : null}

                <iframe
                  key={iframeKey}
                  ref={iframeRef}
                  src={src}
                  title="Pré-visualização do MUV"
                  // Permissões para GPS, câmera e sensores funcionarem dentro do iframe.
                  allow="geolocation; camera; accelerometer; gyroscope; magnetometer; fullscreen"
                  referrerPolicy="no-referrer-when-downgrade"
                  className="w-full flex-1 border-0 bg-ink"
                  style={{ height: bezel ? `calc(${screenH}px - ${bezel ? device.safeTop : 0}px)` : screenH }}
                />

                {bezel ? <span className="device-home" /> : null}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Trilho de rotas para telas estreitas */}
      <div className="border-t border-line px-4 py-4 lg:hidden">
        <p className="eyebrow mb-2">Telas</p>
        <div className="no-scrollbar flex gap-2 overflow-x-auto">
          {ROUTES.map((r) => (
            <button
              key={r.href}
              type="button"
              onClick={() => setSrc(r.href)}
              className={`shrink-0 border px-3 py-2 text-[11px] font-medium ${
                src === r.href ? "border-lime bg-lime/10 text-lime" : "border-line text-muted"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <footer className="border-t border-line px-4 py-5">
        <p className="mx-auto max-w-[900px] text-[11px] leading-relaxed text-muted">
          <span className="font-semibold text-paper">Como usar:</span> o painel mostra o app real dentro de uma viewport de
          celular. Use o trilho à esquerda para navegar, troque o dispositivo e o zoom conforme necessário. Em telas com o mapa,
          o GPS e a câmera usam os recursos do <span className="text-paper">seu computador</span> — para testar os sensores de
          verdade, escaneie o QR e abra no aparelho.
        </p>
        <p className="mx-auto mt-2 max-w-[900px] text-[11px] leading-relaxed text-muted">
          A área segura superior é aproximada pela barra de status. O espaçamento real do sistema (notch/home indicator)
          só é aplicado pelo iOS/Android no aparelho físico.
        </p>
      </footer>
    </div>
  );
}

/* --------------------------- Ícones da barra de status --------------------------- */

function IconCheck() {
  return (
    <svg viewBox="0 0 24 24" className="size-3.5 text-paper" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden="true">
      <path d="M4 15l4.5 4L20 5" />
    </svg>
  );
}

function IconWifi() {
  return (
    <svg viewBox="0 0 24 24" className="size-3.5 text-paper" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden="true">
      <path d="M4.5 10.5a11 11 0 0 1 15 0M7.5 13.8a7 7 0 0 1 9 0M10.5 17a3.4 3.4 0 0 1 3 0" />
      <circle cx="12" cy="19.6" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconBattery() {
  return (
    <svg viewBox="0 0 26 14" className="h-3.5 w-5 text-paper" fill="none" stroke="currentColor" strokeWidth={1.4} aria-hidden="true">
      <rect x="1" y="2.5" width="20" height="9" rx="2.4" />
      <rect x="3" y="4.5" width="13" height="5" rx="1.4" fill="currentColor" stroke="none" />
      <path d="M23 5.6v2.8" strokeLinecap="round" />
    </svg>
  );
}
