import { NextResponse } from "next/server";
import { badRequest, cleanText, dbErrorResponse, readJson } from "@/lib/empresas/errors";
import { requireCompany } from "@/lib/empresas/guard";
import { createAdminSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const g = await requireCompany("stock.ver");
  if (!g.ok) return g.response;
  const { data, error } = await createAdminSupabase().from("company_warehouses").select("id, name, address, active")
    .eq("tenant_id", g.tenantId).order("name");
  if (error) return dbErrorResponse(error, "bodegas GET");
  return NextResponse.json({ warehouses: data });
}

export async function POST(req: Request) {
  const g = await requireCompany("productos.editar");
  if (!g.ok) return g.response;
  const body = await readJson(req);
  const name = cleanText(body?.name, 120);
  if (!name) return badRequest("Escribe el nombre de la bodega.");
  const { data, error } = await createAdminSupabase().from("company_warehouses")
    .insert({ tenant_id: g.tenantId, name, address: cleanText(body?.address, 300) }).select("id, name, address, active").single();
  if (error) return dbErrorResponse(error, "bodegas POST");
  return NextResponse.json({ warehouse: data }, { status: 201 });
}
