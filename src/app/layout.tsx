import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Archivo, Inter } from "next/font/google";
import "leaflet/dist/leaflet.css";
import "./globals.css";
import BottomNav from "@/components/BottomNav";
import PwaRegister from "@/components/PwaRegister";

const display = Archivo({ subsets: ["latin"], weight: ["600", "700", "800", "900"], variable: "--font-display", display: "swap" });
const body = Inter({ subsets: ["latin"], variable: "--font-body", display: "swap" });

export const metadata: Metadata = {
  title: "MUV — Seu movimento. Seu território.",
  description: "Registre corridas, pedais e trilhas com GPS. Explore novos caminhos, conquiste territórios e supere seus limites.",
  applicationName: "MUV",
  appleWebApp: { capable: true, title: "MUV", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
};
export const viewport: Viewport = {
  width: "device-width", initialScale: 1, viewportFit: "cover",
  themeColor: "#101112", interactiveWidget: "resizes-content",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" className={`${display.variable} ${body.variable}`}>
      <body className="text-bone antialiased font-sans">
        <div className="app">
          {children}
          <BottomNav />
        </div>
        <PwaRegister />
      </body>
    </html>
  );
}
