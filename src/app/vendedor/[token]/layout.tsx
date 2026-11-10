import type { Metadata } from "next";

// Pagina privada de un vendedor: no debe aparecer en buscadores.
export const metadata: Metadata = { title: "Mis ventas - re-booking", robots: { index: false, follow: false } };

export default function VendedorLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
