import { redirect } from "next/navigation";
import { PortalShell } from "@/components/socios/shell";
import { loadPartnerContext } from "@/lib/empresas/partner";

export const dynamic = "force-dynamic";

export default async function SociosPortalLayout({ children }: { children: React.ReactNode }) {
  const found = await loadPartnerContext();
  if (found.state !== "ok") redirect(`/socios/login${found.state === "portal_closed" ? "?cerrado=1" : ""}`);
  return <PortalShell companyName={found.context.tenantName} customerName={found.context.customerName}>{children}</PortalShell>;
}
