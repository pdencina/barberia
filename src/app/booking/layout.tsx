import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Agendar Hora | re-booking",
  description: "Agenda tu hora online 24/7 con re-booking. Elige tu profesional, servicio y horario.",
  openGraph: {
    title: "Agendar Hora | re-booking",
    description: "Agenda tu hora online 24/7. Elige tu profesional, servicio y horario.",
  },
};

export default function BookingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
