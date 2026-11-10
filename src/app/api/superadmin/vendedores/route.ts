import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, getCurrentUserRoleAndTenant } from "@/lib/supabase/server";
import { slugifyAd } from "@/lib/ad-tracking";
import { statsDeVendedor } from "@/lib/vendedores";

export const dynamic = "force-dynamic";

// Super admin: crear vendedores con link propio y ver sus metricas (altas iniciadas, pagadas e ingresos del primer cobro).
async function soloSuperAdmin() {
  const { role } = await getCurrentUserRoleAndTenant();
  return role === "super_admin";
}

export async function GET() {
  if (!(await soloSuperAdmin())) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const supabase = createAdminSupabase();
  const { data: sellers, error } = await supabase.from("sellers").select("id, name, slug, token, active, created_at").order("created_at", { ascending: false });
  if (error) return NextResponse.json({ migracion: false, vendedores: [] });
  const { data: rows } = await supabase.from("signup_requests").select("status, amount, plan, created_at, ad_attribution").not("ad_attribution", "is", null).limit(5000);
  const vendedores = (sellers || []).map((s: any) => ({ ...s, stats: statsDeVendedor((rows as any[]) || [], s.slug) }));
  return NextResponse.json({ migracion: true, vendedores });
}

export async function POST(req: NextRequest) {
  if (!(await soloSuperAdmin())) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const b = await req.json().catch(() => ({} as any));
  const name = String(b.name || "").trim().slice(0, 80);
  const slug = slugifyAd(String(b.slug || name), 40);
  if (!name) return NextResponse.json({ error: "Escribe el nombre del vendedor" }, { status: 400 });
  if (!/^[a-z0-9-]{2,40}$/.test(slug)) return NextResponse.json({ error: "El nombre del link debe tener entre 2 y 40 letras o números" }, { status: 400 });
  const { data, error } = await createAdminSupabase().from("sellers").insert({ name, slug }).select("id, name, slug, token, active, created_at").single();
  if (error) {
    const dup = /duplicate|unique/i.test(error.message);
    return NextResponse.json({ error: dup ? "Ya existe un vendedor con ese link" : /does not exist|schema cache/i.test(error.message) ? "Falta aplicar la migración 156 en la base de datos." : "No se pudo crear" }, { status: dup ? 409 : 500 });
  }
  return NextResponse.json({ success: true, vendedor: data });
}

export async function PATCH(req: NextRequest) {
  if (!(await soloSuperAdmin())) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const b = await req.json().catch(() => ({} as any));
  if (!b.id || typeof b.active !== "boolean") return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
  const { error } = await createAdminSupabase().from("sellers").update({ active: b.active }).eq("id", b.id);
  if (error) return NextResponse.json({ error: "No se pudo guardar" }, { status: 500 });
  return NextResponse.json({ success: true });
}
