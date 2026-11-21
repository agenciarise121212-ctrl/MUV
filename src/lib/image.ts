"use client";

/**
 * Compressão de imagens no navegador.
 *
 * Todo o processamento acontece no cliente via HTML5 Canvas: a imagem nunca
 * trafega em tamanho original, o que reduz o payload para o Postgres e o custo
 * de storage no Neon. O alvo é manter cada foto entre 100 KB e 150 KB.
 *
 * Estratégia:
 *  1. Redimensiona para no máximo 1080 px no maior lado.
 *  2. Codifica em WebP (suportado por todos os navegadores modernos, inclusive
 *     o Safari 14+). Se o WebP não estiver disponível, cai para JPEG.
 *  3. Refina a qualidade em passos até o resultado caber na faixa alvo.
 */

export const MAX_SIDE = 1080;
export const TARGET_MIN_BYTES = 100 * 1024;
export const TARGET_MAX_BYTES = 150 * 1024;
/** Limite de fotos por atividade. */
export const MAX_PHOTOS_PER_ACTIVITY = 5;
/** Teto absoluto: acima disso aceitamos a foto para não perder o registro. */
const HARD_MAX_BYTES = 400 * 1024;

export type CompressedImage = {
  /** Data URL pronto para envio (`data:image/webp;base64,...`). */
  dataUrl: string;
  mimeType: string;
  bytes: number;
  width: number;
  height: number;
  /** true quando o navegador não suportou WebP e caiu para JPEG. */
  fellBackToJpeg: boolean;
  /** Qualidade final aplicada na codificação. */
  quality: number;
};

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Não foi possível ler a imagem."));
    reader.readAsDataURL(file);
  });
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Imagem inválida ou corrompida."));
    img.src = dataUrl;
  });
}

function supportsWebp(canvas: HTMLCanvasElement): boolean {
  try {
    return canvas.toDataURL("image/webp").startsWith("data:image/webp");
  } catch {
    return false;
  }
}

/** Codifica o canvas com a melhor qualidade que caiba na faixa alvo. */
function encodeWithinTarget(
  canvas: HTMLCanvasElement,
  mime: string,
): { dataUrl: string; quality: number } {
  const qualities = [0.78, 0.72, 0.7, 0.64, 0.58, 0.5, 0.42];
  let last = { dataUrl: "", quality: 0.7 };
  for (const q of qualities) {
    const dataUrl = canvas.toDataURL(mime, q);
    const bytes = Math.round((dataUrl.length - dataUrl.indexOf(",") - 1) * 0.75);
    last = { dataUrl, quality: q };
    // Dentro da faixa: encerramos.
    if (bytes <= TARGET_MAX_BYTES) {
      return { dataUrl, quality: q };
    }
  }
  // Não alcançou o teto nem na menor qualidade: devolve o último (menor).
  return last;
}

/**
 * Comprime uma imagem do dispositivo para uso nas atividades.
 * `geotag` é opcional e não altera a compressão — apenas documenta a intenção.
 */
export async function compressImage(file: File): Promise<CompressedImage> {
  const original = await readAsDataUrl(file);
  const img = await loadImage(original);

  const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
  const width = Math.max(1, Math.round(img.naturalWidth * scale));
  const height = Math.max(1, Math.round(img.naturalHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Não foi possível processar a imagem neste dispositivo.");

  // Fundo branco: evita que PNGs com transparência virem fundo preto no JPEG.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, width, height);

  const webpOk = supportsWebp(canvas);
  const mime = webpOk ? "image/webp" : "image/jpeg";
  const { dataUrl, quality } = encodeWithinTarget(canvas, mime);
  const bytes = Math.round((dataUrl.length - dataUrl.indexOf(",") - 1) * 0.75);

  return {
    dataUrl,
    mimeType: mime,
    bytes,
    width,
    height,
    fellBackToJpeg: !webpOk,
    quality,
  };
}

/** Rótulo legível do tamanho para a interface. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
