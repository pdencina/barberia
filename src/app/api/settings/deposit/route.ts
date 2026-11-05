import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, resolveTenantForRequest, requireTenantRole } from "@/lib/supabase/server";
import { cargarCredencialAbono } from "@/lib/deposit";

// GET: Fetch deposit settings for a tenant
export async function GET(req: NextRequest) {
  const supabase = createAdminSupabase();
  const { searchParams } = new URL(req.url);
  // Esta lectura es PUBLICA a proposito: la pagina de reservas del cliente (sin sesion) necesita saber si el negocio cobra abono y de cuanto.
  // Solo devuelve datos que el cliente ve igual en esa pagina (nunca tokens). Antes pasaba por la sesion y, sin sesion —o con la sesion de
  // otro negocio—, devolvia vacio o los datos de OTRO negocio: por eso no se pedia el abono.
  const pedido = searchParams.get("tenantId");
  let tenantId: string | null = pedido && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(pedido) ? pedido : null;
  if (!tenantId) ({ tenantId } = await resolveTenantForRequest(pedido));

  if (!tenantId || tenantId === "ALL") return NextResponse.json({});

  let r: { data: any; error: any } = await supabase.from("tenant_settings")
    .select("deposit_enabled, deposit_percentage, deposit_min_amount, cancellation_free_hours, deposit_message, deposit_mode, deposit_fixed_amount, deposit_refund_policy, deposit_refund_hours").eq("tenant_id", tenantId).maybeSingle();
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
    deposit_refund_policy: d?.deposit_refund_policy ?? null,
    deposit_refund_hours: d?.deposit_refund_hours ?? null,
    deposit_ready: !!d?.deposit_enabled && !!cred.token,
  });
}

// POST: Save deposit settings
export async function POST(req: NextRequest) {
  const supabase = createAdminSupabase();
  const body = await req.json();
  const { deposit_enabled, deposit_percentage, cancellation_free_hours, deposit_message, deposit_mode, deposit_fixed_amount, deposit_refund_policy, deposit_refund_hours } = body;
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
  // La politica de devolucion es obligatoria para activar el abono: el cliente la ve antes de pagar.
  const politica = ["none", "until_hours", "always"].includes(deposit_refund_policy) ? deposit_refund_policy : null;
  const horasDev = Math.round(Number(deposit_refund_hours));
  if (deposit_enabled && !politica) return NextResponse.json({ error: "Elige la política de devolución del abono antes de activarlo." }, { status: 400 });
  if (politica === "until_hours" && !(horasDev >= 1 && horasDev <= 720)) return NextResponse.json({ error: "Elige el plazo de devolución." }, { status: 400 });
  const horas = Math.round(Number(cancellation_free_hours));
  const base: Record<string, any> = {
    deposit_enabled: !!deposit_enabled,
    ...(pct >= 1 && pct <= 100 ? { deposit_percentage: pct } : {}),
    ...(horas >= 0 && horas <= 720 ? { cancellation_free_hours: horas } : {}),
    deposit_message: String(deposit_message ?? "").slice(0, 300),
  };
  const nuevos = { deposit_mode: modo, deposit_fixed_amount: fijo, deposit_refund_policy: politica, deposit_refund_hours: politica === "until_hours" ? horasDev : null };
  let { data: upd, error } = await supabase.from("tenant_settings").update({ ...base, ...nuevos }).eq("tenant_id", tenantId).select("tenant_id");
  // Sin la migracion 131 se guarda lo de siempre (solo porcentaje); el monto fijo necesita la migracion.
  if (error && /deposit_mode|deposit_fixed_amount|deposit_refund/.test(error.message)) {
    if (modo === "fixed") return NextResponse.json({ error: "Falta aplicar la migración 131 (monto fijo) y la 135 (política de devolución)." }, { status: 409 });
    ({ data: upd, error } = await supabase.from("tenant_settings").update(base).eq("tenant_id", tenantId).select("tenant_id"));
  }
  if (!error && (!upd || upd.length === 0)) ({ error } = await supabase.from("tenant_settings").insert({ tenant_id: tenantId, ...base }));
  if (error) return NextResponse.json({ error: "No se pudo guardar" }, { status: 500 });
  return NextResponse.json({ success: true });
}
