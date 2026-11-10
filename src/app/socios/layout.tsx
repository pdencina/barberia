import { notFound } from "next/navigation";
import { isEmpresasEnabled } from "@/lib/empresas/flag";

export const metadata = { title: "Portal de distribuidores · re-booking" };

export default function SociosRootLayout({ children }: { children: React.ReactNode }) {
  if (!isEmpresasEnabled()) notFound();
  return <>{children}</>;
}
