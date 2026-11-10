import type { Metadata, Viewport } from "next";
export const metadata: Metadata = { title: "Tótem de autoatención", robots: { index: false, follow: false }, manifest: "/totems.webmanifest" };
export const viewport: Viewport = { width: "device-width", initialScale: 1, maximumScale: 1, userScalable: false };
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
