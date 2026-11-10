import { NextResponse } from "next/server";
import { badRequest, cleanText, dbErrorResponse, isUuid, readJson } from "@/lib/empresas/errors";
import { sendPortalReceipt } from "@/lib/empresas/comprobante";
import { portalWarehouse, requirePartner } from "@/lib/empresas/partner";
import { createAdminSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Los pedidos de SU cliente (los que hizo en el portal y los que le tomó el vendedor). Sin notas internas ni autor.
export async function GET() {
  const p = await requirePartner();
  if (!p.ok) return p.response;
  const { data, error } = await createAdminSupabase().from("company_orders")
    .select("id, status, created_at, source, items:company_order_items(quantity, unit_price, product:company_products(name, sku))")
    .eq("tenant_id", p.tenantId).eq("customer_id", p.customerId).order("created_at", { ascending: false }).limit(100);
  if (error) return dbErrorResponse(error, "socios pedidos GET");
  const orders = (data || []).map((o: any) => ({
    ...o,
    items: (o.items || []).map((i: any) => ({ quantity: i.quantity, name: i.product?.name, sku: i.product?.sku, ...(p.settings.portalShowPrices ? { unitPrice: i.unit_price } : {}) })),
  }));
  return NextResponse.json({ orders });
}

/**
 * El distribuidor arma su pedido. Queda en BORRADOR (no reserva stock): el vendedor lo revisa y lo confirma.
 * Precio del catálogo en el servidor; empresa, cliente y bodega salen de la sesión, nunca del navegador.
 */
export async function POST(req: Request) {
  const p = await requirePartner();
  if (!p.ok) return p.response;
  const body = await readJson(req);
  const raw = Array.isArray(body?.items) ? (body!.items as any[]) : [];
  if (raw.length === 0 || raw.length > 200) return badRequest("Agrega productos al pedido.");
  const ids = new Set<string>();
  for (const item of raw) {
    if (!isUuid(item?.productId) || !Number.isInteger(item?.quantity) || item.quantity < 1 || item.quantity > 100000) {
      return badRequest("Revisa los productos y las cantidades.");
    }
    if (ids.has(item.productId)) return badRequest("Hay un producto repetido en el pedido.");
    ids.add(item.productId);
  }
  const notes = cleanText(body?.notes, 1000);
  const admin = createAdminSupabase();
  const wh = await portalWarehouse(admin, p.tenantId, p.settings.portalWarehouseId);
  if (!wh) return NextResponse.json({ error: "El portal no está disponible por ahora." }, { status: 503 });

  const { data: products, error: productsError } = await admin.from("company_products").select("id, name, sku, list_price, active")
    .eq("tenant_id", p.tenantId).in("id", Array.from(ids));
  if (productsError) return dbErrorResponse(productsError, "socios pedidos productos");
  const catalog = new Map((products || []).map((x) => [x.id, x]));
  if (raw.some((item) => !catalog.get(item.productId)?.active)) return badRequest("Hay un producto que ya no está disponible.");

  const { data: order, error } = await admin.from("company_orders").insert({
    tenant_id: p.tenantId, customer_id: p.customerId, warehouse_id: wh, notes, created_by: p.userId, source: "portal",
  }).select("id").single();
  if (error) return dbErrorResponse(error, "socios pedidos POST");
  const { error: itemsError } = await admin.from("company_order_items").insert(raw.map((item) => ({
    order_id: order.id, tenant_id: p.tenantId, product_id: item.productId, quantity: item.quantity,
    unit_price: catalog.get(item.productId)?.list_price ?? null,
  })));
  if (itemsError) {
    await admin.rpc("company_order_cancel", { p_tenant_id: p.tenantId, p_order_id: order.id, p_user_id: p.userId, p_reason: "No se pudieron guardar los productos" });
    return dbErrorResponse(itemsError, "socios pedidos líneas");
  }

  const lines = raw.map((item) => {
    const x = catalog.get(item.productId)!;
    return { name: x.name, sku: x.sku, quantity: item.quantity, unitPrice: x.list_price };
  });
  const receipt = await sendPortalReceipt(admin, { tenantId: p.tenantId, companyName: p.tenantName, customerId: p.customerId, customerName: p.customerName, orderId: order.id, lines, notes });
  return NextResponse.json({
    order: { id: order.id, status: "draft", lines: lines.map((l) => ({ name: l.name, quantity: l.quantity, ...(p.settings.portalShowPrices ? { unitPrice: l.unitPrice } : {}) })) },
    receipt,
  }, { status: 201 });
}
