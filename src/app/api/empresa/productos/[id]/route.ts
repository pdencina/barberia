import { NextResponse } from "next/server";
import { badRequest, cleanText, dbErrorResponse, isUuid, notFound, readJson } from "@/lib/empresas/errors";
import { requireCompany } from "@/lib/empresas/guard";
import { createAdminSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const g = await requireCompany("productos.editar");
  if (!g.ok) return g.response;
  if (!isUuid(params.id)) return notFound();
  const body = await readJson(req);
  if (!body) return badRequest("Datos no válidos.");
  const update: Record<string, unknown> = {};
  if ("name" in body) {
    const name = cleanText(body.name, 200);
    if (!name) return badRequest("Escribe el nombre del producto.");
    update.name = name;
  }
  if ("sku" in body) update.sku = cleanText(body.sku, 80);
  if ("category" in body) update.category = cleanText(body.category, 80);
  if ("active" in body) update.active = body.active === true;
  for (const [key, column] of [["listPrice", "list_price"], ["cost", "cost"]] as const) {
    if (key in body) {
      const n = body[key] === null || body[key] === "" ? null : Number(body[key]);
      if (n !== null && (!Number.isFinite(n) || n < 0)) return badRequest("El precio o el costo no son válidos.");
      update[column] = n;
    }
  }
  if ("minStock" in body) {
    const n = Number(body.minStock);
    if (!Number.isInteger(n) || n < 0) return badRequest("El stock mínimo no es válido.");
    update.min_stock = n;
  }
  if (Object.keys(update).length === 0) return badRequest("No hay cambios.");
  const { data, error } = await createAdminSupabase().from("company_products").update(update)
    .eq("id", params.id).eq("tenant_id", g.tenantId).select("id").maybeSingle();
  if (error) return dbErrorResponse(error, "productos PATCH");
  if (!data) return notFound();
  return NextResponse.json({ ok: true });
}
