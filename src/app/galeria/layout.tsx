import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Galeria de Trabajos | EstudioLevels",
  description: "Mira el nivel de nuestros barberos. Galeria de cortes y trabajos. EstudioLevels, Puente Alto.",
};

export default function GaleriaLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
