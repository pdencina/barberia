import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Karla, JetBrains_Mono } from "next/font/google";

// Mismas tipografías del sitio de re-booking: títulos Bricolage Grotesque, texto Karla y etiquetas JetBrains Mono.
const display = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-display", display: "swap" });
const body = Karla({ subsets: ["latin"], variable: "--font-body", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });

export const metadata: Metadata = {
  title: "Tótem de autoatención",
  robots: { index: false, follow: false },
  manifest: "/totems.webmanifest",
  other: { "mobile-web-app-capable": "yes" },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, maximumScale: 1, userScalable: false, themeColor: "#0A0A0A", viewportFit: "cover" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${display.variable} ${body.variable} ${mono.variable}`} style={{ fontFamily: "var(--font-body), system-ui, sans-serif" }}>
      <style>{`
        .tt-display { font-family: var(--font-display), Georgia, sans-serif; letter-spacing: -0.02em; }
        .tt-mono { font-family: var(--font-mono), ui-monospace, monospace; }
        /* Pantalla horizontal: todo el tótem escala con el alto/ancho de la pantalla (1920x1080 = tamaño base de 16px). */
        html { font-size: clamp(9px, min(1.48vh, 0.83vw), 26px); background: #0A0A0A; }
        html, body { overscroll-behavior: none; -webkit-user-select: none; user-select: none; -webkit-tap-highlight-color: transparent; }
        body { background: #0A0A0A; }
      `}</style>
      {children}
    </div>
  );
}
