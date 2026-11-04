import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, getCurrentUserRoleAndTenant } from "@/lib/supabase/server";
import { todayInChile } from "@/lib/utils";
import { validarEntradaPersonal } from "@/lib/personal-entries";

export const dynamic = "force-dynamic";

// Movimientos PERSONALES (gastos e ingresos) de Mi Billetera. Privados: cada persona ve y toca SOLO los suyos
// (el user_id sale de la sesion, nunca del navegador); ni el administrador los ve. Tolera que falte la migracion 124.
async function yo() {
  const { userId, role, tenantId } = await getCurrentUserRoleAndTenant();
  if (!userId || !role || role === "client") return null;
  return { userId, tenantId: tenantId && tenantId !== "ALL" ? tenantId : null };
}
const faltaTabla = (m?: string) => /does not exist|schema cache|relation .* personal_entries/i.test(m || "");
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: NextRequest) {
  const u = await yo();
  if (!u) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const sp = new URL(req.url).searchParams;
  const hoy = todayInChile();
  const desde = FECHA.test(sp.get("desde") || "") ? sp.get("desde")! : `${hoy.slice(0, 7)}-01`;
  const hasta = FECHA.test(sp.get("hasta") || "") ? sp.get("hasta")! : hoy;
  const { data, error } = await createAdminSupabase().from("personal_entries")
    .select("id, kind, amount, description, category, entry_date, source, created_at")
    .eq("user_id", u.userId).gte("entry_date", desde).lte("entry_date", hasta)
    .order("entry_date", { ascending: false }).order("created_at", { ascending: false }).limit(1000);
  if (error) return NextResponse.json(faltaTabla(error.message) ? { migracionPendiente: true, items: [] } : { error: "No pude leer tus movimientos" }, { status: faltaTabla(error.message) ? 200 : 500 });
  return NextResponse.json({ items: data || [], desde, hasta });
}

export async function POST(req: NextRequest) {
  const u = await yo();
  if (!u) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const v = validarEntradaPersonal(await req.json().catch(() => ({})), todayInChile());
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
  const { data, error } = await createAdminSupabase().from("personal_entries").insert({ ...v.value, user_id: u.userId, tenant_id: u.tenantId }).select("id, kind, amount, description, category, entry_date, source").single();
  if (error) return NextResponse.json({ error: faltaTabla(error.message) ? "Falta aplicar la migración 124 en la base de datos." : "No pude guardar el movimiento" }, { status: faltaTabla(error.message) ? 409 : 500 });
  return NextResponse.json({ success: true, item: data });
}

export async function PATCH(req: NextRequest) {
  const u = await yo();
  if (!u) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id") || "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Movimiento no valido" }, { status: 400 });
  const v = validarEntradaPersonal(await req.json().catch(() => ({})), todayInChile(), true);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
  delete (v.value as any).source;
  const { data, error } = await createAdminSupabase().from("personal_entries").update(v.value).eq("id", id).eq("user_id", u.userId).select("id").maybeSingle();
  if (error) return NextResponse.json({ error: "No pude actualizar el movimiento" }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Movimiento no encontrado" }, { status: 404 });
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const u = await yo();
  if (!u) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id") || "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Movimiento no valido" }, { status: 400 });
  const { data, error } = await createAdminSupabase().from("personal_entries").delete().eq("id", id).eq("user_id", u.userId).select("id").maybeSingle();
  if (error) return NextResponse.json({ error: "No pude borrar el movimiento" }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Movimiento no encontrado" }, { status: 404 });
  return NextResponse.json({ success: true });
}
