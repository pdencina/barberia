import { NextResponse } from "next/server";
import { requireCompany } from "@/lib/empresas/guard";

export const dynamic = "force-dynamic";

export async function GET() {
  const g = await requireCompany();
  if (!g.ok) return g.response;
  return NextResponse.json({ tenantName: g.tenantName, role: g.role, capabilities: g.capabilities });
}
