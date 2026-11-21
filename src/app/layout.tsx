import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Archivo, Inter } from "next/font/google";
import "./globals.css";

const archivo = Archivo({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800", "900"],
  variable: "--font-archivo",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "MUV — Seu movimento. Seu território.",
  description:
    "Registre corridas, trilhas e pedais com GPS real. Explore territórios, dispute missões, conquiste recompensas e evolua com a comunidade MUV.",
  applicationName: "MUV",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "MUV",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/apple-touch-icon.svg" }],
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#101112",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" className={`${archivo.variable} ${inter.variable}`}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
