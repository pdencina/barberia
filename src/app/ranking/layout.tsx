import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Ranking Profesionales | re-booking",
  description: "Conoce a nuestro equipo de profesionales. Reviews y calificaciones de clientes reales.",
};

export default function RankingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
