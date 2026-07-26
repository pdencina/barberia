import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Agendar Hora | EstudioLevels - Barberia Premium Puente Alto",
  description: "Agenda tu corte de pelo online 24/7 en EstudioLevels. Elige tu barbero, servicio y horario. Puente Alto, Chile.",
  openGraph: {
    title: "Agendar Hora | EstudioLevels",
    description: "Barberia Premium en Puente Alto. Agenda tu corte online.",
  },
};

export default function BookingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
