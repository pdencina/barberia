import { NextResponse } from "next/server";
import { requirePartner } from "@/lib/empresas/partner";

export const dynamic = "force-dynamic";

export async function GET() {
  const p = await requirePartner();
  if (!p.ok) return p.response;
  return NextResponse.json({ companyName: p.tenantName, customerName: p.customerName, showPrices: p.settings.portalShowPrices, stockMode: p.settings.portalStockMode });
}
