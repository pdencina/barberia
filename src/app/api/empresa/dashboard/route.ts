import { NextResponse } from "next/server";
import { fetchAllRows } from "@/lib/accounting";
import { buildDashboard, lastMonths, NO_BRAND, periodRanges, type DashOrder, type Period } from "@/lib/empresas/dashboard";
import { dbErrorResponse, isUuid, missingMigration } from "@/lib/empresas/errors";
import { requireCompany } from "@/lib/empresas/guard";
import { faltaMigracion } from "@/lib/empresas/settings";
import { createAdminSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const PERIODS: Period[] = ["month", "30d", "quarter", "year"];

const toOrder = (o: any, at: string): DashOrder => ({
  id: o.id, customerId: o.customer_id, customerName: o.customer?.name || "Cliente", dispatchedAt: at,
  items: (o.items || []).map((i: any) => ({ productId: i.product_id, quantity: i.quantity, unitPrice: i.unit_price === null ? null : Number(i.unit_price) })),
});

/**
 * Dashboard del dueño: ventas, margen, unidades, pedidos y stock por marca. Solo dueño (incluye costos).
 * ?period=month|30d|quarter|year · ?brand=<id>|sin-marca
 */
export async function GET(req: Request) {
  const g = await requireCompany("reporte.ver");
  if (!g.ok) return g.response;
  const q = new URL(req.url).searchParams;
  const period = (PERIODS.includes(q.get("period") as Period) ? q.get("period") : "month") as Period;
  const brandParam = q.get("brand");
  const brandFilter = brandParam === NO_BRAND || isUuid(brandParam) ? brandParam : null;
  const now = Date.now();
  // Se lee desde lo más antiguo que se necesita: el período anterior o los 6 meses del gráfico.
  const since = new Date(Math.min(periodRanges(period, now).prevFrom, lastMonths(now, 6)[0].from)).toISOString();
  const admin = createAdminSupabase();
  try {
    const { data: brands, error: brandsError } = await admin.from("company_brands").select("id, name, color, active").eq("tenant_id", g.tenantId).order("sort");
    if (brandsError) throw brandsError;
    const products = await fetchAllRows(() => admin.from("company_products").select("id, name, sku, brand_id, cost, list_price, min_stock, active").eq("tenant_id", g.tenantId)) as any[];
    const sold = await fetchAllRows(() => admin.from("company_orders")
      .select("id, customer_id, dispatched_at, customer:company_customers(name), items:company_order_items(product_id, quantity, unit_price)")
      .eq("tenant_id", g.tenantId).in("status", ["dispatched", "delivered"]).gte("dispatched_at", since)) as any[];
    const pending = await fetchAllRows(() => admin.from("company_orders")
      .select("id, customer_id, created_at, items:company_order_items(product_id, quantity, unit_price)")
      .eq("tenant_id", g.tenantId).in("status", ["confirmed", "prepared"])) as any[];
    const stock: any[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await admin.from("company_warehouse_stock").select("product_id, quantity, reserved_quantity")
        .eq("tenant_id", g.tenantId).order("warehouse_id").order("product_id").range(from, from + 999);
      if (error) throw error;
      stock.push(...(data || []));
      if (!data || data.length < 1000) break;
    }
    const dash = buildDashboard({
      now, period, brandFilter,
      brands: (brands || []).map((b) => ({ id: b.id, name: b.name, color: b.color, active: b.active })),
      products: products.map((p) => ({
        id: p.id, name: p.name, sku: p.sku, brandId: p.brand_id, cost: p.cost === null ? null : Number(p.cost),
        listPrice: p.list_price === null ? null : Number(p.list_price), minStock: p.min_stock ?? 0, active: p.active,
      })),
      orders: sold.map((o) => toOrder(o, o.dispatched_at)),
      pending: pending.map((o) => toOrder(o, o.created_at)),
      stock: stock.map((s) => ({ productId: s.product_id, quantity: s.quantity, reserved: s.reserved_quantity })),
    });
    return NextResponse.json({ ...dash, allBrands: (brands || []).filter((b) => b.active) });
  } catch (e: any) {
    if (faltaMigracion(e)) return missingMigration(162);
    return dbErrorResponse(e, "dashboard GET");
  }
}
