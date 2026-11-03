import { NextResponse } from "next/server";
import { badRequest, cleanText, dbErrorResponse, isUuid, readJson } from "@/lib/empresas/errors";
import { requireCompany } from "@/lib/empresas/guard";
import { createAdminSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const g = await requireCompany("conteos.ver");
  if (!g.ok) return g.response;
  const { data, error } = await createAdminSupabase().from("company_inventory_counts")
    .select("id, status, notes, created_at, closed_at, warehouse_id, warehouse:company_warehouses(name)")
    .eq("tenant_id", g.tenantId).order("created_at", { ascending: false }).limit(100);
  if (error) return dbErrorResponse(error, "conteos GET");
  return NextResponse.json({ counts: data });
}

export async function POST(req: Request) {
  const g = await requireCompany("conteos.contar");
  if (!g.ok) return g.response;
  const body = await readJson(req);
  if (!isUuid(body?.warehouseId)) return badRequest("Elige una bodega.");
  const { data, error } = await createAdminSupabase().rpc("company_count_open", {
    p_tenant_id: g.tenantId, p_warehouse_id: body?.warehouseId, p_user_id: g.userId, p_notes: cleanText(body?.notes, 500),
  });
  if (error) return dbErrorResponse(error, "conteos POST");
  return NextResponse.json({ id: data }, { status: 201 });
}
