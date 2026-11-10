import { NextResponse } from "next/server";
import { dbErrorResponse } from "@/lib/empresas/errors";
import { requireCompany } from "@/lib/empresas/guard";
import { createAdminSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Físico, reservado y disponible por producto y bodega. Disponible negativo = faltante: el conteo encontró menos de lo comprometido.
export async function GET() {
  const g = await requireCompany("stock.ver");
  if (!g.ok) return g.response;
  const admin = createAdminSupabase();
  try {
    // Esta tabla no tiene columna id: se pagina aquí con su llave (bodega, producto), porque fetchAllRows ordena por id.
    const rows: any[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await admin.from("company_warehouse_stock")
        .select("warehouse_id, product_id, quantity, reserved_quantity, product:company_products(name, sku, min_stock, active), warehouse:company_warehouses(name)")
        .eq("tenant_id", g.tenantId).order("warehouse_id").order("product_id").range(from, from + 999);
      if (error) return dbErrorResponse(error, "stock GET");
      rows.push(...(data || []));
      if (!data || data.length < 1000) break;
    }
    return NextResponse.json({
      stock: rows.map((r) => ({
        warehouseId: r.warehouse_id,
        warehouseName: r.warehouse?.name,
        productId: r.product_id,
        productName: r.product?.name,
        sku: r.product?.sku,
        productActive: r.product?.active,
        minStock: r.product?.min_stock ?? 0,
        quantity: r.quantity,
        reserved: r.reserved_quantity,
        available: r.quantity - r.reserved_quantity,
      })),
    });
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
