import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Ranking Barberos | EstudioLevels",
  description: "Conoce a nuestro equipo de barberos. Reviews y calificaciones de clientes reales. EstudioLevels, Puente Alto.",
};

export default function RankingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
