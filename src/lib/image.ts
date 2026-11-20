// Compressão no navegador: máx. 1080px, WebP (fallback JPEG), alvo ~100–150 KB.
export const MAX_PHOTOS = 5;
const TARGET_BYTES = 150 * 1024;

const bytesOf = (dataUrl: string) => Math.round((dataUrl.length - dataUrl.indexOf(",") - 1) * 0.75);

export async function compressImage(file: Blob, maxDim = 1080): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error("Imagem inválida")); i.src = url; });
    let dim = maxDim; let last = "";
    for (let attempt = 0; attempt < 3; attempt++) {
      const scale = Math.min(1, dim / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(img.naturalWidth * scale)); c.height = Math.max(1, Math.round(img.naturalHeight * scale));
      const ctx = c.getContext("2d")!;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, c.width, c.height);
      const webp = c.toDataURL("image/webp", 0.7).startsWith("data:image/webp"); // Safari antigo não gera WebP
      const type = webp ? "image/webp" : "image/jpeg";
      for (const q of [0.7, 0.62, 0.54, 0.46]) {
        const out = c.toDataURL(type, q); last = out;
        if (bytesOf(out) <= TARGET_BYTES) return out;
      }
      dim = Math.round(dim * 0.8); // ainda pesada: reduz dimensões e tenta de novo
    }
    if (last) return last; // menor versão obtida
    throw new Error("Não foi possível comprimir a imagem.");
  } finally { URL.revokeObjectURL(url); }
}
export { bytesOf };
