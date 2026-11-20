// Carimbo editorial MUV para Stories/WhatsApp (gerado no navegador via Canvas)
export type PhotoMeta = { lat?: number | null; lng?: number | null; kmMark?: number | null; takenAt?: string | null };

const cityCache = new Map<string, string>();
async function cityOf(lat: number, lng: number) {
  const k = `${lat.toFixed(2)},${lng.toFixed(2)}`;
  if (cityCache.has(k)) return cityCache.get(k)!;
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&zoom=10&lat=${lat}&lon=${lng}&accept-language=pt-BR`, { signal: AbortSignal.timeout(5000) });
    const j = await r.json();
    const c = j.address?.city || j.address?.town || j.address?.village || j.address?.municipality || j.address?.county || "";
    cityCache.set(k, c); return c;
  } catch { return ""; }
}

export async function stampPhoto(photoId: number, meta: PhotoMeta, fallbackDate?: string) {
  const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = `/api/photos/${photoId}`; });
  await document.fonts?.ready;
  const W = img.naturalWidth, H = img.naturalHeight, u = Math.max(W, H) / 1080; // unidade proporcional
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(img, 0, 0);
  // véu sutil só na base, para legibilidade
  const g = ctx.createLinearGradient(0, H - 260 * u, 0, H);
  g.addColorStop(0, "rgba(16,17,18,0)"); g.addColorStop(1, "rgba(16,17,18,.72)");
  ctx.fillStyle = g; ctx.fillRect(0, H - 260 * u, W, 260 * u);

  const city = meta.lat != null && meta.lng != null ? await cityOf(meta.lat, meta.lng) : "";
  const date = new Date(meta.takenAt ?? fallbackDate ?? Date.now()).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).replace(".", "");
  const display = getComputedStyle(document.documentElement).getPropertyValue("--font-display").trim() || "sans-serif";
  const x = 56 * u, y = H - 64 * u;
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#D5FF45";
  ctx.font = `900 ${64 * u}px ${display}, sans-serif`;
  ctx.fillText("MUV", x, y);
  const mw = ctx.measureText("MUV").width;
  ctx.fillRect(x + mw + 10 * u, y - 10 * u, 34 * u, 8 * u); // traço da marca
  ctx.fillStyle = "rgba(245,245,242,.92)";
  ctx.font = `600 ${24 * u}px ${display}, sans-serif`;
  const parts = [meta.kmMark != null ? `KM ${meta.kmMark.toFixed(2).replace(".", ",")}` : null, city || null, date].filter(Boolean).join("  ·  ").toUpperCase();
  ctx.fillText(parts, x + mw + 60 * u, y - 4 * u);

  const blob = await new Promise<Blob>((res) => c.toBlob((b) => res(b!), "image/jpeg", 0.92));
  const file = new File([blob], `muv-${photoId}.jpg`, { type: "image/jpeg" });
  if (navigator.canShare?.({ files: [file] })) { try { await navigator.share({ files: [file], title: "MUV" }); return; } catch (e) { if ((e as Error).name === "AbortError") return; } }
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = file.name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
