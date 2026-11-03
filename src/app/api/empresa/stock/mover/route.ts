import { NextResponse } from "next/server";
import { roleCan } from "@/lib/empresas/capabilities";
import { badRequest, cleanText, dbErrorResponse, isUuid, readJson } from "@/lib/empresas/errors";
import { requireCompany } from "@/lib/empresas/guard";
import { createAdminSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const g = await requireCompany("stock.mover");
  if (!g.ok) return g.response;
  const body = await readJson(req);
  const type = body?.type;
  if (type !== "in" && type !== "out" && type !== "adjust" && type !== "transfer") return badRequest("El tipo de movimiento no es válido.");
  if (type === "adjust" && !roleCan(g.role, "stock.ajustar")) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  if (!isUuid(body?.productId) || !isUuid(body?.warehouseId)) return badRequest("Elige producto y bodega.");
  if (body?.toWarehouseId != null && !isUuid(body.toWarehouseId)) return badRequest("La bodega de destino no es válida.");
  if (!Number.isInteger(body?.quantity)) return badRequest("La cantidad no es válida.");
  const key = cleanText(body?.idempotencyKey, 100);
  if (!key) return badRequest("Falta la llave del movimiento.");

  const { data, error } = await createAdminSupabase().rpc("company_stock_move", {
    p_tenant_id: g.tenantId,
    p_type: type,
    p_product_id: body?.productId,
    p_warehouse_id: body?.warehouseId,
    p_quantity: body?.quantity,
    p_created_by: g.userId,
    p_to_warehouse_id: body?.toWarehouseId ?? null,
    p_reason: cleanText(body?.reason, 500),
    p_idempotency_key: key,
  });
  if (error) return dbErrorResponse(error, "stock mover");
  return NextResponse.json({ replayed: data?.replayed === true });
}
