import sharp from "sharp";
import { emblemDef, isEmblem, SPRITE_COLS, SPRITE_ROWS, SPRITE_URL } from "@/lib/emblems";

// Recorta a célula da sprite, remove o fundo branco (flood-fill a partir das bordas) e devolve WebP transparente.
// Cache em memória + cache HTTP imutável. Fonte original continua sendo o Imgur.
const mem = new Map<string, Buffer>();
let spriteBuf: Promise<Buffer> | null = null;
const fetchBuf = async (url: string) => { const r = await fetch(url, { cache: "force-cache" }); if (!r.ok) throw new Error(String(r.status)); return Buffer.from(await r.arrayBuffer()); };

export async function GET(_: Request, ctx: { params: Promise<{ key: string }> }) {
  const key = (await ctx.params).key;
  if (!isEmblem(key)) return new Response("not found", { status: 404 });
  const hit = mem.get(key);
  if (hit) return out(hit);
  try {
    const def = emblemDef(key);
    let img: ReturnType<typeof sharp>;
    if (def.overrideUrl) img = sharp(await fetchBuf(def.overrideUrl));
    else {
      spriteBuf ??= fetchBuf(SPRITE_URL).catch((e) => { spriteBuf = null; throw e; });
      const src = await spriteBuf;
      const meta = await sharp(src).metadata();
      const cw = meta.width! / SPRITE_COLS, ch = meta.height! / SPRITE_ROWS, pad = def.padding ?? 6;
      img = sharp(src).extract({ left: Math.round(def.col * cw + pad), top: Math.round(def.row * ch + pad), width: Math.round(cw - pad * 2), height: Math.round(ch - pad * 2) });
    }
    const { data, info } = await img.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    knockOutWhite(data, info.width, info.height);
    const size = Math.round(192 * (def.scale ?? 1));
    const buf = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).trim({ threshold: 1 }).resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).webp({ quality: 86, alphaQuality: 90 }).toBuffer();
    mem.set(key, buf);
    return out(buf);
  } catch {
    return new Response("upstream", { status: 502 });
  }
}

function out(buf: Buffer) {
  return new Response(new Uint8Array(buf), { headers: { "Content-Type": "image/webp", "Cache-Control": "public, max-age=604800, stale-while-revalidate=2592000" } });
}

function knockOutWhite(d: Buffer, w: number, h: number) {
  const seen = new Uint8Array(w * h);
  const stack: number[] = [];
  const isBg = (i: number) => d[i * 4] > 228 && d[i * 4 + 1] > 228 && d[i * 4 + 2] > 228;
  for (let x = 0; x < w; x++) { stack.push(x, (h - 1) * w + x); }
  for (let y = 0; y < h; y++) { stack.push(y * w, y * w + w - 1); }
  while (stack.length) {
    const p = stack.pop()!;
    if (seen[p] || !isBg(p)) continue;
    seen[p] = 1; d[p * 4 + 3] = 0;
    const x = p % w, y = (p / w) | 0;
    if (x > 0) stack.push(p - 1); if (x < w - 1) stack.push(p + 1); if (y > 0) stack.push(p - w); if (y < h - 1) stack.push(p + w);
  }
  // suaviza a borda: pixels claros vizinhos ao fundo ficam semi-transparentes
  for (let p = 0; p < w * h; p++) {
    if (seen[p]) continue;
    const x = p % w, y = (p / w) | 0;
    const nb = (x > 0 && seen[p - 1]) || (x < w - 1 && seen[p + 1]) || (y > 0 && seen[p - w]) || (y < h - 1 && seen[p + w]);
    if (nb) { const l = (d[p * 4] + d[p * 4 + 1] + d[p * 4 + 2]) / 3; if (l > 190) d[p * 4 + 3] = Math.round(255 * (1 - (l - 190) / 65)); }
  }
}
