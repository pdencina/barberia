import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Galeria de Trabajos | re-booking",
  description: "Mira el nivel de nuestros profesionales. Galeria de cortes y trabajos.",
};

export default function GaleriaLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
