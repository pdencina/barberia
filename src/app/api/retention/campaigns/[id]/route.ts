import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, requireRole, resolveTenantForRequest } from "@/lib/supabase/server";
import { getCampaignDetail } from "@/lib/retention-campaigns";

// GET: una campana con la lista de a quien se le envio. Solo administracion y solo de este negocio.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireRole(["admin", "super_admin"]);
  if (!guard.ok) return guard.response;
  const { searchParams } = new URL(req.url);
  const { tenantId } = await resolveTenantForRequest(searchParams.get("tenantId"));
  if (!tenantId || tenantId === "ALL") return NextResponse.json({ error: "No se pudo identificar el negocio" }, { status: 400 });
  const detail = await getCampaignDetail(createAdminSupabase(), tenantId, params.id);
  if (!detail) return NextResponse.json({ error: "Campaña no encontrada" }, { status: 404 });
  return NextResponse.json(detail);
}
