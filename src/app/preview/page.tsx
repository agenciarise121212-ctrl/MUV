import { headers } from "next/headers";
import QRCode from "qrcode";
import { PreviewShell } from "@/components/PreviewShell";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "MUV — Simulador mobile",
  description: "Visualize o MUV em uma viewport de celular direto no navegador do computador.",
};

/**
 * Simulador mobile.
 *
 * Renderiza o app real dentro de uma moldura de dispositivo, para que qualquer
 * ajuste de interface mobile possa ser conferido no computador sem depender de
 * ferramentas externas. O QR aponta para o mesmo deploy, para validar sensores
 * no aparelho físico.
 */
export default async function PreviewPage() {
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const shareUrl = `${proto}://${host}`;

  let qrSvg: string | null = null;
  try {
    qrSvg = await QRCode.toString(shareUrl, {
      type: "svg",
      margin: 1,
      width: 200,
      color: { dark: "#101112", light: "#F5F5F2" },
    });
  } catch {
    qrSvg = null;
  }

  return <PreviewShell qrSvg={qrSvg} shareUrl={shareUrl} />;
}
