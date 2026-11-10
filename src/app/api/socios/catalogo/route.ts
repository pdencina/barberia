import { NextResponse } from "next/server";
import { fetchAllRows } from "@/lib/accounting";
import { dbErrorResponse } from "@/lib/empresas/errors";
import { portalWarehouse, requirePartner, stockView } from "@/lib/empresas/partner";
import { createAdminSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Catálogo activo con disponibilidad en línea de la bodega del portal. Nunca muestra costos ni otras bodegas.
export async function GET() {
  const p = await requirePartner();
  if (!p.ok) return p.response;
  const admin = createAdminSupabase();
  try {
    const wh = await portalWarehouse(admin, p.tenantId, p.settings.portalWarehouseId);
    const products = await fetchAllRows(() => admin.from("company_products").select("id, sku, name, description, category, unit, list_price")
      .eq("tenant_id", p.tenantId).eq("active", true).order("name")) as any[];
    const stock = new Map<string, number>();
    if (wh) {
      const { data, error } = await admin.from("company_warehouse_stock").select("product_id, quantity, reserved_quantity")
        .eq("tenant_id", p.tenantId).eq("warehouse_id", wh);
      if (error) throw error;
      for (const s of data || []) stock.set(s.product_id, s.quantity - s.reserved_quantity);
    }
    return NextResponse.json({
      products: products.map((x) => ({
        id: x.id, sku: x.sku, name: x.name, description: x.description, category: x.category, unit: x.unit,
        ...(p.settings.portalShowPrices ? { price: x.list_price } : {}),
        ...stockView(stock.get(x.id) ?? 0, p.settings.portalStockMode),
      })),
    });
  } catch (e: any) {
    return dbErrorResponse(e, "socios catálogo");
  }
}
