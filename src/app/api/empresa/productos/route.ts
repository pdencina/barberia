import { NextResponse } from "next/server";
import { fetchAllRows } from "@/lib/accounting";
import { roleCan } from "@/lib/empresas/capabilities";
import { badRequest, cleanText, dbErrorResponse, isUuid, readJson } from "@/lib/empresas/errors";
import { requireCompany } from "@/lib/empresas/guard";
import { faltaMigracion } from "@/lib/empresas/settings";
import { createAdminSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const OLD_BASE = "id, sku, name, description, category, unit, list_price, min_stock, active";
// brand_id es de la migración 162: si falta, se lee como antes.
const BASE = `${OLD_BASE}, brand_id`;

const money = (v: unknown): number | null | undefined => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
};

export async function GET() {
  const g = await requireCompany("productos.ver");
  if (!g.ok) return g.response;
  const columns = roleCan(g.role, "costos.ver") ? `${BASE}, cost` : BASE;
  const admin = createAdminSupabase();
  try {
    try {
      return NextResponse.json({ products: await fetchAllRows(() => admin.from("company_products").select(columns).eq("tenant_id", g.tenantId).order("name")) });
    } catch (e: any) {
      if (!faltaMigracion(e)) throw e;
      const old = roleCan(g.role, "costos.ver") ? `${OLD_BASE}, cost` : OLD_BASE;
      return NextResponse.json({ products: await fetchAllRows(() => admin.from("company_products").select(old).eq("tenant_id", g.tenantId).order("name")) });
    }
  } catch (e: any) {
    return dbErrorResponse(e, "productos GET");
  }
}

export async function POST(req: Request) {
  const g = await requireCompany("productos.editar");
  if (!g.ok) return g.response;
  const body = await readJson(req);
  const name = cleanText(body?.name, 200);
  if (!name) return badRequest("Escribe el nombre del producto.");
  const list_price = money(body?.listPrice);
  const cost = money(body?.cost);
  if (list_price === undefined || cost === undefined) return badRequest("El precio o el costo no son válidos.");
  const min_stock = Number(body?.minStock ?? 0);
  if (!Number.isInteger(min_stock) || min_stock < 0) return badRequest("El stock mínimo no es válido.");
  const admin = createAdminSupabase();
  const brand_id = isUuid(body?.brandId) ? body!.brandId : null;
  if (brand_id) {
    const { data: brand } = await admin.from("company_brands").select("id").eq("tenant_id", g.tenantId).eq("id", brand_id).maybeSingle();
    if (!brand) return badRequest("Esa marca no existe.");
  }
  const { data, error } = await admin.from("company_products").insert({
    ...(brand_id ? { brand_id } : {}),
    tenant_id: g.tenantId,
    name,
    sku: cleanText(body?.sku, 80),
    category: cleanText(body?.category, 80),
    unit: cleanText(body?.unit, 20) || "unidad",
    list_price,
    cost,
    min_stock,
  }).select(`${brand_id ? BASE : OLD_BASE}, cost`).single();
  if (error) return dbErrorResponse(error, "productos POST");
  return NextResponse.json({ product: data }, { status: 201 });
}
