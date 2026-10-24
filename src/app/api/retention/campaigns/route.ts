import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, requireRole, resolveTenantForRequest } from "@/lib/supabase/server";
import { listCampaigns } from "@/lib/retention-campaigns";

// GET: campanas de Retencion ya enviadas por ESTE negocio (mas recientes primero). Solo administracion.
export async function GET(req: NextRequest) {
  const guard = await requireRole(["admin", "super_admin"]);
  if (!guard.ok) return guard.response;
  const { searchParams } = new URL(req.url);
  const { tenantId } = await resolveTenantForRequest(searchParams.get("tenantId"));
  if (!tenantId || tenantId === "ALL") return NextResponse.json({ campaigns: [], migrationMissing: false });
  const { campaigns, migrationMissing } = await listCampaigns(createAdminSupabase(), tenantId, 200);
  return NextResponse.json({ campaigns, migrationMissing });
}
