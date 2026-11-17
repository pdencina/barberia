import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Karla, JetBrains_Mono } from "next/font/google";

const display = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-display", display: "swap" });
const body = Karla({ subsets: ["latin"], variable: "--font-body", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });

export const metadata: Metadata = { title: "Mi código", robots: { index: false, follow: false } };
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0A0A0A" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${display.variable} ${body.variable} ${mono.variable}`} style={{ fontFamily: "var(--font-body), system-ui, sans-serif", background: "#0A0A0A", minHeight: "100vh" }}>
      <style>{`
        .tt-display { font-family: var(--font-display), Georgia, sans-serif; letter-spacing: -0.02em; }
        .tt-mono { font-family: var(--font-mono), ui-monospace, monospace; }
        html, body { background: #0A0A0A; }
      `}</style>
      {children}
    </div>
  );
}
