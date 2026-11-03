import { notFound } from "next/navigation";
import { isEmpresasEnabled } from "@/lib/empresas/flag";

export const metadata = { title: "re-booking Empresas" };

export default function EmpresaRootLayout({ children }: { children: React.ReactNode }) {
  if (!isEmpresasEnabled()) notFound();
  return <>{children}</>;
}
