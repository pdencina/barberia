import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mi Portal | re-booking",
  description: "Consulta tus citas, historial y puntos de fidelidad.",
};

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
