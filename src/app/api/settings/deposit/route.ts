import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, resolveTenantForRequest, requireTenantRole } from "@/lib/supabase/server";
import { cargarCredencialAbono } from "@/lib/deposit";

// GET: Fetch deposit settings for a tenant
export async function GET(req: NextRequest) {
  const supabase = createAdminSupabase();
  const { searchParams } = new URL(req.url);
  // Never trust the tenantId coming from the browser — see resolveTenantForRequest.
  const { tenantId } = await resolveTenantForRequest(searchParams.get("tenantId"));

  if (!tenantId || tenantId === "ALL") return NextResponse.json({});

  let r: { data: any; error: any } = await supabase.from("tenant_settings")
    .select("deposit_enabled, deposit_percentage, deposit_min_amount, cancellation_free_hours, deposit_message, deposit_mode, deposit_fixed_amount").eq("tenant_id", tenantId).maybeSingle();
  if (r.error) r = await supabase.from("tenant_settings").select("deposit_enabled, deposit_percentage, deposit_min_amount, cancellation_free_hours, deposit_message").eq("tenant_id", tenantId).maybeSingle();
  const d = r.data;
  // «Listo» = el negocio tiene una cuenta de Mercado Pago conectada. Sin ella el abono no se exige (la reserva sigue normal).
  const cred = d?.deposit_enabled ? await cargarCredencialAbono(supabase, tenantId) : { token: null };
  return NextResponse.json({
    deposit_enabled: !!d?.deposit_enabled,
    deposit_mode: d?.deposit_mode === "fixed" ? "fixed" : "percent",
    deposit_percentage: d?.deposit_percentage ?? 30,
    deposit_fixed_amount: d?.deposit_fixed_amount ?? null,
    deposit_min_amount: d?.deposit_min_amount ?? null,
    cancellation_free_hours: d?.cancellation_free_hours ?? 24,
    deposit_message: d?.deposit_message ?? "Este servicio requiere un abono para confirmar tu cita.",
    deposit_ready: !!d?.deposit_enabled && !!cred.token,
  });
}

// POST: Save deposit settings
export async function POST(req: NextRequest) {
  const supabase = createAdminSupabase();
  const body = await req.json();
  const { deposit_enabled, deposit_percentage, cancellation_free_hours, deposit_message, deposit_mode, deposit_fixed_amount } = body;
  // SEGURIDAD: antes no pedia sesion y confiaba en el tenantId del cuerpo: cualquiera podia
  // cambiar las credenciales de cobro de cualquier negocio. Solo admin, solo de su negocio.
  const guard = await requireTenantRole(["admin", "super_admin"], body.tenantId);
  if (!guard.ok) return guard.response;
  const tenantId = guard.tenantId;

  const modo = deposit_mode === "fixed" ? "fixed" : "percent";
  const pct = Math.round(Number(deposit_percentage));
  const fijo = deposit_fixed_amount === null || deposit_fixed_amount === undefined || deposit_fixed_amount === "" ? null : Math.round(Number(deposit_fixed_amount));
  if (modo === "percent" && !(pct >= 1 && pct <= 100)) return NextResponse.json({ error: "El porcentaje debe estar entre 1 y 100" }, { status: 400 });
  if (modo === "fixed" && !(fijo !== null && fijo >= 100 && fijo <= 10_000_000)) return NextResponse.json({ error: "El monto del abono debe estar entre $100 y $10.000.000" }, { status: 400 });
  const horas = Math.round(Number(cancellation_free_hours));
  const base: Record<string, any> = {
    deposit_enabled: !!deposit_enabled,
    ...(pct >= 1 && pct <= 100 ? { deposit_percentage: pct } : {}),
    ...(horas >= 0 && horas <= 720 ? { cancellation_free_hours: horas } : {}),
    deposit_message: String(deposit_message ?? "").slice(0, 300),
  };
  const nuevos = { deposit_mode: modo, deposit_fixed_amount: fijo };
  let { data: upd, error } = await supabase.from("tenant_settings").update({ ...base, ...nuevos }).eq("tenant_id", tenantId).select("tenant_id");
  // Sin la migracion 131 se guarda lo de siempre (solo porcentaje); el monto fijo necesita la migracion.
  if (error && /deposit_mode|deposit_fixed_amount/.test(error.message)) {
    if (modo === "fixed") return NextResponse.json({ error: "Falta aplicar la migración 131 para usar un monto fijo." }, { status: 409 });
    ({ data: upd, error } = await supabase.from("tenant_settings").update(base).eq("tenant_id", tenantId).select("tenant_id"));
  }
  if (!error && (!upd || upd.length === 0)) ({ error } = await supabase.from("tenant_settings").insert({ tenant_id: tenantId, ...base }));
  if (error) return NextResponse.json({ error: "No se pudo guardar" }, { status: 500 });
  return NextResponse.json({ success: true });
}
