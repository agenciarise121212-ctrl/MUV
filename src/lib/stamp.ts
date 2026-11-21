"use client";

import { avatarColor, initials } from "@/lib/format";

/**
 * Carimbo editorial do MUV sobre a foto.
 *
 * Gerado via Canvas no cliente: assinatura discreta no canto inferior com o
 * logotipo MUV em #D5FF45, o quilômetro do treino, a cidade e a data. A imagem
 * original não é reprocessada no servidor — o resultado é o arquivo final pronto
 * para Stories ou WhatsApp.
 */

export type StampInput = {
  /** Data URL da foto comprimida. */
  photoDataUrl: string;
  kmMark: number | null;
  distanceM: number | null;
  city: string | null;
  takenAt: string;
  sportLabel?: string;
  athleteName?: string;
  athleteColor?: string | null;
};

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Não foi possível ler a imagem."));
    img.src = src;
  });
}

function formatKm(meters: number | null): string {
  if (!meters || meters <= 0) return "0,0 km";
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1).replace(".", ",")} km`;
}

/** Desenha o selo MUV no canto inferior e devolve o JPEG resultante. */
export async function renderStampedPhoto(input: StampInput): Promise<{ dataUrl: string; bytes: number }> {
  const img = await loadImage(input.photoDataUrl);

  // Mantém a proporção original, respeitando o teto do Stories (1080 de largura).
  const maxSide = 1080;
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const width = Math.max(1, Math.round(img.naturalWidth * scale));
  const height = Math.max(1, Math.round(img.naturalHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Não foi possível processar a imagem neste dispositivo.");

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, width, height);

  /* --------------------------- Assinatura editorial --------------------------- */

  const LIME = "#D5FF45";
  const PAPER = "#F5F5F2";
  const pad = Math.round(width * 0.045);
  const barHeight = Math.round(height * 0.15);
  const barTop = height - barHeight;

  // Véu inferior para legibilidade sem poluir a imagem.
  const veil = ctx.createLinearGradient(0, barTop - Math.round(height * 0.06), 0, height);
  veil.addColorStop(0, "rgba(16,17,18,0)");
  veil.addColorStop(1, "rgba(16,17,18,0.78)");
  ctx.fillStyle = veil;
  ctx.fillRect(0, barTop - Math.round(height * 0.06), width, Math.round(height * 0.06) + barHeight);

  // Marca vertical de assinatura (tick) na cor da marca.
  const tickW = Math.max(3, Math.round(width * 0.007));
  const tickH = Math.round(barHeight * 0.52);
  ctx.fillStyle = LIME;
  ctx.fillRect(pad, barTop + Math.round((barHeight - tickH) / 2), tickW, tickH);

  const baseline = barTop + Math.round(barHeight * 0.46);
  const dateLabel = new Date(input.takenAt).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  // Texto principal: MUV · distância
  const titleSize = Math.round(width * 0.042);
  ctx.font = `900 ${titleSize}px Archivo, "Helvetica Neue", Arial, sans-serif`;
  ctx.textBaseline = "alphabetic";
  const title = "MUV";
  const titleWidth = ctx.measureText(title).width;

  const kmSize = Math.round(width * 0.036);
  ctx.font = `800 ${kmSize}px Archivo, "Helvetica Neue", Arial, sans-serif`;
  const kmText = formatKm(input.kmMark !== null ? input.kmMark * 1000 : input.distanceM);
  const kmWidth = ctx.measureText(kmText).width;

  let cursor = pad + tickW + Math.round(width * 0.022);
  ctx.fillStyle = LIME;
  ctx.font = `900 ${titleSize}px Archivo, "Helvetica Neue", Arial, sans-serif`;
  ctx.fillText(title, cursor, baseline);
  cursor += titleWidth + Math.round(width * 0.018);

  ctx.fillStyle = PAPER;
  ctx.font = `800 ${kmSize}px Archivo, "Helvetica Neue", Arial, sans-serif`;
  ctx.fillText(kmText, cursor, baseline);
  cursor += kmWidth + Math.round(width * 0.014);

  // Linha secundária: cidade · data · modalidade
  const subSize = Math.round(width * 0.026);
  const parts = [input.city, dateLabel, input.sportLabel].filter(Boolean).filter((v) => typeof v === "string" && v.trim());
  const sub = parts.join("  ·  ");
  ctx.font = `600 ${subSize}px Inter, "Helvetica Neue", Arial, sans-serif`;
  ctx.fillStyle = "rgba(245,245,242,0.72)";
  ctx.fillText(sub.slice(0, 64), pad + tickW + Math.round(width * 0.022), baseline + Math.round(barHeight * 0.34));

  // Monograma do atleta à direita (opcional, discreto)
  if (input.athleteName) {
    const mono = Math.round(width * 0.05);
    const cx = width - pad - mono / 2;
    const cy = barTop + barHeight / 2;
    ctx.beginPath();
    ctx.arc(cx, cy, mono / 2, 0, Math.PI * 2);
    ctx.fillStyle = avatarColor(input.athleteColor);
    ctx.fill();
    ctx.font = `800 ${Math.round(mono * 0.36)}px Archivo, "Helvetica Neue", Arial, sans-serif`;
    ctx.fillStyle = "#101112";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(initials(input.athleteName), cx, cy + mono * 0.02);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  }

  const mime = "image/jpeg";
  let dataUrl = canvas.toDataURL(mime, 0.86);
  let bytes = Math.round((dataUrl.length - dataUrl.indexOf(",") - 1) * 0.75);

  // Garante um arquivo leve para compartilhamento.
  if (bytes > 600 * 1024) {
    dataUrl = canvas.toDataURL(mime, 0.74);
    bytes = Math.round((dataUrl.length - dataUrl.indexOf(",") - 1) * 0.75);
  }

  return { dataUrl, bytes };
}

/** Dispara o download da imagem carimbada. */
export function downloadStamped(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
