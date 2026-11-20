import { ImageResponse } from "next/og";
export const size = { width: 512, height: 512 };
export const contentType = "image/png";
export default function Icon() {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", background: "#101112", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
      <div style={{ color: "#F5F5F2", fontSize: 170, fontWeight: 900, letterSpacing: -10, lineHeight: 1 }}>MUV</div>
      <div style={{ width: 120, height: 22, background: "#D5FF45", marginTop: 18, transform: "skewX(-20deg)" }} />
    </div>, size);
}
