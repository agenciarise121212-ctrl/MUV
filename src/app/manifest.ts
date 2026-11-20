import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MUV — Corrida, Pedal e Trilha", short_name: "MUV", start_url: "/", scope: "/", display: "standalone", orientation: "portrait",
    background_color: "#101112", theme_color: "#101112", lang: "pt-BR",
    description: "Registre atividades com GPS, explore territórios e complete missões.",
    icons: [
      { src: "/icon", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
    shortcuts: [{ name: "Gravar atividade", url: "/record" }, { name: "Mapa", url: "/map" }],
  };
}
