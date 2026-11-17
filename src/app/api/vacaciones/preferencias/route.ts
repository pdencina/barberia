import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, getCallerForView } from "@/lib/supabase/server";
import { cargarPrefs, faltaMigracion } from "@/lib/vacation-requests";
import { DIAS_MAX_POR_ANIO, esFechaValida } from "@/lib/vacation-rules";

// Preferencias de vacaciones del negocio (solo administrador): dias laborales por año que puede pedir cada profesional,
// cuando se reinicia el derecho y la fecha de ingreso de cada profesional.
async function admin() {
  const c = await getCallerForView();
  if ((c.role !== "admin" && c.role !== "super_admin") || !c.tenantId || c.tenantId === "ALL") return null;
  return c;
}

export async function GET() {
  const c = await admin();
  if (!c) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const supabase = createAdminSupabase();
  const { prefs, migracionFalta } = await cargarPrefs(supabase, c.tenantId!);
  return NextResponse.json({ ...prefs, migracionFalta, maxDias: DIAS_MAX_POR_ANIO });
}

// { diasPorAnio: 1..30 | null, modo: "calendar" | "anniversary" }   o   { barberId, ingreso: "YYYY-MM-DD" | null }
export async function PUT(req: NextRequest) {
  const c = await admin();
  if (!c) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const body = await req.json().catch(() => ({} as any));
  const supabase = createAdminSupabase();

  if (typeof body?.barberId === "string") {
    const ingreso = body.ingreso === null || body.ingreso === "" ? null : body.ingreso;
    if (ingreso !== null && !esFechaValida(ingreso)) return NextResponse.json({ error: "Fecha de ingreso no válida." }, { status: 400 });
    const { data, error } = await supabase.from("profiles").update({ vacation_start_date: ingreso }).eq("id", body.barberId).eq("tenant_id", c.tenantId!).select("id");
    if (error) return NextResponse.json({ error: faltaMigracion(error) ? "Falta aplicar la migración 171." : "No se pudo guardar." }, { status: 409 });
    if (!data || data.length === 0) return NextResponse.json({ error: "Profesional no encontrado" }, { status: 404 });
    return NextResponse.json({ success: true });
  }

  const dias = body?.diasPorAnio === null ? null : Number(body?.diasPorAnio);
  if (dias !== null && !(Number.isInteger(dias) && dias >= 1 && dias <= DIAS_MAX_POR_ANIO)) return NextResponse.json({ error: `Elige entre 1 y ${DIAS_MAX_POR_ANIO} días por año.` }, { status: 400 });
  const modo = body?.modo === "anniversary" ? "anniversary" : "calendar";
  const { error } = await supabase.from("tenants").update({ vacation_days_per_year: dias, vacation_reset_mode: modo }).eq("id", c.tenantId!);
  if (error) return NextResponse.json({ error: faltaMigracion(error) ? "Falta aplicar la migración 171." : "No se pudo guardar." }, { status: 409 });
  return NextResponse.json({ success: true });
}
