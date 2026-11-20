import { ImageResponse } from "next/og";
export const size = { width: 180, height: 180 };
export const contentType = "image/png";
export default function Icon() {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", background: "#101112", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
      <div style={{ color: "#F5F5F2", fontSize: 62, fontWeight: 900, letterSpacing: -3, lineHeight: 1 }}>MUV</div>
      <div style={{ width: 44, height: 8, background: "#D5FF45", marginTop: 8, transform: "skewX(-20deg)" }} />
    </div>, size);
}
