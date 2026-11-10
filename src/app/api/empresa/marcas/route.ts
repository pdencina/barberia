import { NextResponse } from "next/server";
import { BRAND_COLORS } from "@/lib/empresas/dashboard";
import { badRequest, cleanText, dbErrorResponse, missingMigration, readJson } from "@/lib/empresas/errors";
import { requireCompany } from "@/lib/empresas/guard";
import { faltaMigracion } from "@/lib/empresas/settings";
import { createAdminSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const isColor = (v: unknown): v is string => typeof v === "string" && /^#[0-9A-Fa-f]{6}$/.test(v);

export async function GET() {
  const g = await requireCompany("productos.ver");
  if (!g.ok) return g.response;
  const { data, error } = await createAdminSupabase().from("company_brands").select("id, name, color, active, sort")
    .eq("tenant_id", g.tenantId).order("sort").order("name");
  if (error) return faltaMigracion(error) ? missingMigration(162) : dbErrorResponse(error, "marcas GET");
  return NextResponse.json({ brands: data });
}

export async function POST(req: Request) {
  const g = await requireCompany("productos.editar");
  if (!g.ok) return g.response;
  const body = await readJson(req);
  const name = cleanText(body?.name, 80);
  if (!name) return badRequest("Escribe el nombre de la marca.");
  const admin = createAdminSupabase();
  const { count } = await admin.from("company_brands").select("id", { count: "exact", head: true }).eq("tenant_id", g.tenantId);
  const color = isColor(body?.color) ? body!.color : BRAND_COLORS[(count ?? 0) % BRAND_COLORS.length];
  const { data, error } = await admin.from("company_brands").insert({ tenant_id: g.tenantId, name, color, sort: count ?? 0 })
    .select("id, name, color, active, sort").single();
  if (error) {
    if (error.code === "23505") return NextResponse.json({ error: "Ya existe una marca con ese nombre." }, { status: 409 });
    return faltaMigracion(error) ? missingMigration(162) : dbErrorResponse(error, "marcas POST");
  }
  return NextResponse.json({ brand: data }, { status: 201 });
}
