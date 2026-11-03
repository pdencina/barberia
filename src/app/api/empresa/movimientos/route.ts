import { NextResponse } from "next/server";
import { dbErrorResponse, isUuid } from "@/lib/empresas/errors";
import { requireCompany } from "@/lib/empresas/guard";
import { createAdminSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const g = await requireCompany("stock.ver");
  if (!g.ok) return g.response;
  const productId = new URL(req.url).searchParams.get("productId");
  let q = createAdminSupabase().from("company_stock_movements")
    .select("id, movement_type, quantity_delta, balance_after, reason, order_id, count_id, created_at, product:company_products(name), warehouse:company_warehouses(name)")
    .eq("tenant_id", g.tenantId).order("created_at", { ascending: false }).limit(200);
  if (isUuid(productId)) q = q.eq("product_id", productId);
  const { data, error } = await q;
  if (error) return dbErrorResponse(error, "movimientos GET");
  return NextResponse.json({ movements: data });
}
