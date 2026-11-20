"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Icon from "./Icon";

type BIP = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

export default function Settings() {
  const [weight, setWeight] = useState("70");
  const [radius, setRadius] = useState(35);
  const [saved, setSaved] = useState(false);
  const [bip, setBip] = useState<BIP | null>(null);
  const [standalone, setStandalone] = useState(false);
  useEffect(() => {
    setWeight(localStorage.getItem("muv-weight") || "70");
    setRadius(Number(localStorage.getItem("muv-capture-radius")) || 35);
    setStandalone(window.matchMedia("(display-mode: standalone)").matches);
    const f = (e: Event) => { e.preventDefault(); setBip(e as BIP); };
    window.addEventListener("beforeinstallprompt", f);
    return () => window.removeEventListener("beforeinstallprompt", f);
  }, []);
  const row = "flex items-center gap-4 py-4 border-b border-line";
  return (
    <div>
      <form className={row} onSubmit={(e) => { e.preventDefault(); const w = Number(weight); if (w >= 30 && w <= 250) { localStorage.setItem("muv-weight", String(w)); setSaved(true); setTimeout(() => setSaved(false), 1500); (document.activeElement as HTMLElement)?.blur(); } }}>
        <Icon name="user" size={20} className="text-mute" />
        <label className="flex-1 text-[14px]">Peso<span className="block text-[11px] text-mute">Usado no cálculo de calorias</span></label>
        <input inputMode="numeric" enterKeyHint="done" value={weight} onChange={(e) => setWeight(e.target.value.replace(/\D/g, ""))} className="field !w-20 text-center num" aria-label="Peso em kg" />
        <button className={`tap btn btn-sm ${saved ? "btn-lime" : "btn-ghost"}`}>{saved ? <Icon name="check" size={16} /> : "kg"}</button>
      </form>
      <div className={`${row} flex-wrap`}>
        <Icon name="target" size={20} className="text-mute" />
        <label htmlFor="cap-r" className="flex-1 text-[14px]">Raio de captura<span className="block text-[11px] text-mute">Distância para interagir com missões. O servidor soma até 25 m de margem de precisão do GPS (máx. 80 m).</span></label>
        <span className="num text-[14px] w-12 text-right">{radius} m</span>
        <input id="cap-r" type="range" min={20} max={80} step={5} value={radius} onChange={(e) => { const v = Number(e.target.value); setRadius(v); localStorage.setItem("muv-capture-radius", String(v)); }} className="w-full accent-[#D5FF45] h-8" />
      </div>
      <div className={row}>
        <Icon name="download" size={20} className="text-mute" />
        <span className="flex-1 text-[14px]">Instalar na tela inicial<span className="block text-[11px] text-mute">{standalone ? "Rodando como app instalado" : bip ? "Disponível neste navegador" : "No iPhone: Compartilhar → Adicionar à Tela de Início"}</span></span>
        {bip && !standalone && <button onClick={async () => { await bip.prompt(); setBip(null); }} className="tap btn btn-lime btn-sm">Instalar</button>}
      </div>
      <button onClick={() => { localStorage.removeItem("muv-map-prefs"); alert("Preferências do mapa redefinidas."); }} className={`${row} w-full text-left tap`}>
        <Icon name="layers" size={20} className="text-mute" /><span className="flex-1 text-[14px]">Redefinir camadas do mapa</span><Icon name="chevron" size={16} className="text-mute" />
      </button>
      <Link href="/welcome" className={`${row} tap`}><Icon name="flag" size={20} className="text-mute" /><span className="flex-1 text-[14px]">Sobre o MUV</span><Icon name="chevron" size={16} className="text-mute" /></Link>
      <Link href="/compare" className={`${row} tap`}><Icon name="compare" size={20} className="text-mute" /><span className="flex-1 text-[14px]">Comparar atividades</span><Icon name="chevron" size={16} className="text-mute" /></Link>
    </div>
  );
}
