import { NextResponse } from "next/server";
import { BODEGA_ORDER_STATUSES, roleCan } from "@/lib/empresas/capabilities";
import { badRequest, cleanText, dbErrorResponse, isUuid, readJson } from "@/lib/empresas/errors";
import { requireCompany } from "@/lib/empresas/guard";
import { customerDiscount, priceWithTier } from "@/lib/empresas/precios";
import { faltaMigracion } from "@/lib/empresas/settings";
import { createAdminSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const LIST = "id, status, notes, created_by, created_at, customer:company_customers(name), warehouse:company_warehouses(name), items:company_order_items(quantity)";

export async function GET() {
  const g = await requireCompany();
  if (!g.ok) return g.response;
  const admin = createAdminSupabase();
  const build = (columns: string) => admin.from("company_orders").select(columns)
    .eq("tenant_id", g.tenantId).order("created_at", { ascending: false }).limit(200);
  let q = build(`${LIST}, source`);
  if (roleCan(g.role, "pedidos.ver_todos")) {
    // sin filtro
  } else if (roleCan(g.role, "pedidos.ver_propios")) {
    // Sus pedidos y los de su cartera (incluidos los del portal de distribuidores). Sin la 158, solo los suyos.
    const { data: mine, error: mineError } = await admin.from("company_customers").select("id").eq("tenant_id", g.tenantId).eq("assigned_seller_id", g.userId);
    const ids = mineError ? [] : (mine || []).map((c) => c.id);
    q = ids.length ? q.or(`created_by.eq.${g.userId},customer_id.in.(${ids.join(",")})`) : q.eq("created_by", g.userId);
  } else if (roleCan(g.role, "pedidos.ver_bodega")) {
    q = q.in("status", [...BODEGA_ORDER_STATUSES]);
  } else {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  let { data, error } = await q;
  if (error && faltaMigracion(error) && roleCan(g.role, "pedidos.ver_todos")) ({ data, error } = await build(LIST));
  if (error && faltaMigracion(error) && roleCan(g.role, "pedidos.ver_propios")) ({ data, error } = await build(LIST).eq("created_by", g.userId));
  if (error && faltaMigracion(error) && roleCan(g.role, "pedidos.ver_bodega")) ({ data, error } = await build(LIST).in("status", [...BODEGA_ORDER_STATUSES]));
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
  // Un vendedor no puede tomar pedidos de un cliente que está en la cartera de otro.
  if (!roleCan(g.role, "cartera.ver_todas")) {
    const { data: customer, error: customerError } = await admin.from("company_customers").select("assigned_seller_id")
      .eq("tenant_id", g.tenantId).eq("id", body!.customerId).maybeSingle();
    if (customerError && !faltaMigracion(customerError)) return dbErrorResponse(customerError, "pedidos POST cliente");
    if (customer?.assigned_seller_id && customer.assigned_seller_id !== g.userId) return badRequest("Ese cliente está en la cartera de otro vendedor.");
  }
  const { data: products, error: productsError } = await admin.from("company_products").select("id, list_price, active")
    .eq("tenant_id", g.tenantId).in("id", Array.from(ids));
  if (productsError) return dbErrorResponse(productsError, "pedidos POST productos");
  const catalog = new Map((products || []).map((p) => [p.id, p]));
  if (raw.some((item) => !catalog.get(item.productId)?.active)) return badRequest("Hay un producto que no existe o está inactivo.");

  // Precio con el tramo del cliente (mayorista), calculado en el servidor.
  const { discountPct } = await customerDiscount(admin, g.tenantId, body!.customerId as string);
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
    unit_price: priceWithTier(catalog.get(item.productId)?.list_price, discountPct),
  })));
  if (itemsError) {
    await admin.rpc("company_order_cancel", { p_tenant_id: g.tenantId, p_order_id: order.id, p_user_id: g.userId, p_reason: "No se pudieron guardar los productos" });
    return dbErrorResponse(itemsError, "pedidos POST líneas");
  }
  return NextResponse.json({ order: { id: order.id, status: "draft" } }, { status: 201 });
}
