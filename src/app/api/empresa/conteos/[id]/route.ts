import { NextResponse } from "next/server";
import { roleCan } from "@/lib/empresas/capabilities";
import { badRequest, dbErrorResponse, isUuid, notFound, readJson } from "@/lib/empresas/errors";
import { requireCompany } from "@/lib/empresas/guard";
import { createAdminSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Conteo a ciegas: quien cuenta no recibe lo que dice el sistema. Solo el dueño ve las diferencias.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const g = await requireCompany("conteos.ver");
  if (!g.ok) return g.response;
  if (!isUuid(params.id)) return notFound();
  const admin = createAdminSupabase();
  const { data: count, error } = await admin.from("company_inventory_counts")
    .select("id, status, notes, created_at, closed_at, warehouse_id, warehouse:company_warehouses(name)")
    .eq("id", params.id).eq("tenant_id", g.tenantId).maybeSingle();
  if (error) return dbErrorResponse(error, "conteo GET");
  if (!count) return notFound();
  const showSystem = roleCan(g.role, "conteos.ver_sistema");
  const columns = `product_id, counted_quantity, counted_at, product:company_products(name, sku)${showSystem ? ", system_quantity" : ""}`;
  const { data: lines, error: linesError } = await admin.from("company_inventory_count_lines").select(columns)
    .eq("count_id", params.id).eq("tenant_id", g.tenantId).order("counted_at", { ascending: false });
  if (linesError) return dbErrorResponse(linesError, "conteo líneas");
  return NextResponse.json({ count, lines });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const g = await requireCompany("conteos.contar");
  if (!g.ok) return g.response;
  if (!isUuid(params.id)) return notFound();
  const body = await readJson(req);
  const action = body?.action;
  const admin = createAdminSupabase();
  const args = { p_tenant_id: g.tenantId, p_count_id: params.id, p_user_id: g.userId };

  if (action === "record") {
    if (!isUuid(body?.productId) || !Number.isInteger(body?.counted) || (body?.counted as number) < 0) return badRequest("Revisa el producto y la cantidad.");
    const { error } = await admin.rpc("company_count_record", { ...args, p_product_id: body?.productId, p_counted: body?.counted });
    if (error) return dbErrorResponse(error, "conteo anotar");
    return NextResponse.json({ ok: true });
  }
  if (action === "close" || action === "cancel") {
    if (!roleCan(g.role, "conteos.cerrar")) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    const { data, error } = await admin.rpc(action === "close" ? "company_count_close" : "company_count_cancel", args);
    if (error) return dbErrorResponse(error, `conteo ${action}`);
    return NextResponse.json({ status: data?.status, productsChanged: data?.products_changed ?? 0, replayed: data?.replayed === true });
  }
  return badRequest("La acción no es válida.");
}
