import { redirect } from "next/navigation";
import { CompanyShell } from "@/components/empresa/shell";
import { loadCompanyContext } from "@/lib/empresas/guard";

export const dynamic = "force-dynamic";

export default async function EmpresaPanelLayout({ children }: { children: React.ReactNode }) {
  const found = await loadCompanyContext();
  if (found.state !== "ok") redirect("/empresa/login");
  const { tenantName, role, capabilities } = found.context;
  return <CompanyShell tenantName={tenantName} role={role} capabilities={capabilities}>{children}</CompanyShell>;
}
