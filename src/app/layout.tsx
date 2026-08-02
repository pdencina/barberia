import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"] });

export const metadata: Metadata = {
  title: "re-booking - Sistema de Gestion",
  description: "Todo tu negocio. Un solo sistema. El software de gestion todo en uno para agendar, atender, fidelizar y hacer crecer tu negocio.",
  icons: { icon: "/logo.png" },
  viewport: "width=device-width, initial-scale=1, maximum-scale=1",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/icon-white.png" />
        <link rel="apple-touch-icon" href="/icon-blue.png" />
        <meta name="theme-color" content="#1E88E5" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body className={jakarta.className}>{children}</body>
    </html>
  );
}
