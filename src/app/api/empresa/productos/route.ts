import { NextResponse } from "next/server";
import { fetchAllRows } from "@/lib/accounting";
import { roleCan } from "@/lib/empresas/capabilities";
import { badRequest, cleanText, dbErrorResponse, readJson } from "@/lib/empresas/errors";
import { requireCompany } from "@/lib/empresas/guard";
import { createAdminSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const BASE = "id, sku, name, description, category, unit, list_price, min_stock, active";

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
    const rows = await fetchAllRows(() => admin.from("company_products").select(columns).eq("tenant_id", g.tenantId).order("name"));
    return NextResponse.json({ products: rows });
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
  const { data, error } = await createAdminSupabase().from("company_products").insert({
    tenant_id: g.tenantId,
    name,
    sku: cleanText(body?.sku, 80),
    category: cleanText(body?.category, 80),
    unit: cleanText(body?.unit, 20) || "unidad",
    list_price,
    cost,
    min_stock,
  }).select(`${BASE}, cost`).single();
  if (error) return dbErrorResponse(error, "productos POST");
  return NextResponse.json({ product: data }, { status: 201 });
}
