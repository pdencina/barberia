import { NextResponse } from "next/server";
import { BODEGA_ORDER_STATUSES, roleCan } from "@/lib/empresas/capabilities";
import { badRequest, cleanText, dbErrorResponse, isUuid, readJson } from "@/lib/empresas/errors";
import { requireCompany } from "@/lib/empresas/guard";
import { createAdminSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const g = await requireCompany();
  if (!g.ok) return g.response;
  let q = createAdminSupabase().from("company_orders")
    .select("id, status, notes, created_by, created_at, customer:company_customers(name), warehouse:company_warehouses(name), items:company_order_items(quantity)")
    .eq("tenant_id", g.tenantId).order("created_at", { ascending: false }).limit(200);
  if (roleCan(g.role, "pedidos.ver_todos")) {
    // sin filtro
  } else if (roleCan(g.role, "pedidos.ver_propios")) {
    q = q.eq("created_by", g.userId);
  } else if (roleCan(g.role, "pedidos.ver_bodega")) {
    q = q.in("status", [...BODEGA_ORDER_STATUSES]);
  } else {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  const { data, error } = await q;
  if (error) return dbErrorResponse(error, "pedidos GET");
  return NextResponse.json({ orders: data });
}

// El precio sale del catálogo en el servidor: nunca del navegador. Empresa y autor salen de la sesión.
export async function POST(req: Request) {
  const g = await requireCompany("pedidos.crear");
  if (!g.ok) return g.response;
  const body = await readJson(req);
  if (!isUuid(body?.customerId) || !isUuid(body?.warehouseId)) return badRequest("Elige cliente y bodega.");
  const raw = Array.isArray(body?.items) ? (body?.items as any[]) : [];
  if (raw.length === 0 || raw.length > 500) return badRequest("Agrega productos al pedido.");
  const ids = new Set<string>();
  for (const item of raw) {
    if (!isUuid(item?.productId) || !Number.isInteger(item?.quantity) || item.quantity < 1 || item.quantity > 1000000000) {
      return badRequest("Revisa los productos y las cantidades.");
    }
    if (ids.has(item.productId)) return badRequest("Hay un producto repetido en el pedido.");
    ids.add(item.productId);
  }

  const admin = createAdminSupabase();
  const { data: products, error: productsError } = await admin.from("company_products").select("id, list_price, active")
    .eq("tenant_id", g.tenantId).in("id", Array.from(ids));
  if (productsError) return dbErrorResponse(productsError, "pedidos POST productos");
  const catalog = new Map((products || []).map((p) => [p.id, p]));
  if (raw.some((item) => !catalog.get(item.productId)?.active)) return badRequest("Hay un producto que no existe o está inactivo.");

  const { data: order, error } = await admin.from("company_orders").insert({
    tenant_id: g.tenantId,
    customer_id: body?.customerId,
    warehouse_id: body?.warehouseId,
    notes: cleanText(body?.notes, 1000),
    created_by: g.userId,
  }).select("id").single();
  if (error) return dbErrorResponse(error, "pedidos POST");

  const { error: itemsError } = await admin.from("company_order_items").insert(raw.map((item) => ({
    order_id: order.id,
    tenant_id: g.tenantId,
    product_id: item.productId,
    quantity: item.quantity,
    unit_price: catalog.get(item.productId)?.list_price ?? null,
  })));
  if (itemsError) {
    await admin.rpc("company_order_cancel", { p_tenant_id: g.tenantId, p_order_id: order.id, p_user_id: g.userId, p_reason: "No se pudieron guardar los productos" });
    return dbErrorResponse(itemsError, "pedidos POST líneas");
  }
  return NextResponse.json({ order: { id: order.id, status: "draft" } }, { status: 201 });
}
