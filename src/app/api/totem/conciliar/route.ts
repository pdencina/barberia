import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, requireTenantRole } from "@/lib/supabase/server";
import { resolverTerminal, consultarCobroDetalle } from "@/lib/totem-terminal";

// POST {tenantId?, dias?: 1-90, aplicar?: boolean}: revisa los pagos con tarjeta hechos en el tótem (solo administración).
// Vuelve a leer en Mercado Pago/TUU cada cobro aprobado y compara lo COBRADO con lo realmente PAGADO: la diferencia es la propina que el cliente agregó
// en la máquina. Con aplicar=false solo muestra qué encontró; con aplicar=true guarda el monto pagado y la propina (100% al profesional, como en el POS)
// en el pago y en su venta. Nunca cambia el total de la venta ni toca ventas que ya tengan propina.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const guard = await requireTenantRole(["admin", "super_admin"], body.tenantId);
  if (!guard.ok) return guard.response;
  const supabase = createAdminSupabase();
  const dias = Math.max(1, Math.min(90, Math.floor(Number(body.dias) || 30)));
  const aplicar = body.aplicar === true;
  const desde = new Date(Date.now() - dias * 86400_000).toISOString();

  const { data: pagos } = await supabase.from("kiosk_payments")
    .select("id, tenant_id, appointment_id, amount, paid_amount, paid_at, provider, external_id, transaction_id")
    .eq("tenant_id", guard.tenantId).eq("method", "terminal").eq("status", "paid").not("external_id", "is", null).gte("paid_at", desde).order("paid_at", { ascending: false }).limit(100);

  const filas: any[] = [];
  for (const k of pagos || []) {
    const { data: ap } = await supabase.from("appointments").select("barber_id, client:clients(name), barber:profiles!barber_id(name)").eq("id", (k as any).appointment_id).maybeSingle();
    const base = { id: (k as any).id, fecha: (k as any).paid_at, profesional: (ap as any)?.barber?.name || "", cliente: String((ap as any)?.client?.name || "").trim(), cobrado: Number((k as any).amount) };
    const term = await resolverTerminal(supabase, guard.tenantId, (ap as any)?.barber_id);
    if (!term) { filas.push({ ...base, estado: "sin_maquina" }); continue; }
    const det = await consultarCobroDetalle(term, (k as any).external_id);
    if (det.estado !== "approved" || !det.montos) { filas.push({ ...base, estado: "no_se_pudo_leer" }); continue; }
    const pagado = det.montos.pagado ?? base.cobrado;
    const propina = det.montos.propina || 0;
    let estado = propina > 0 ? "con_propina" : "sin_propina";
    if (aplicar) {
      await supabase.from("kiosk_payments").update({ paid_amount: pagado, tip_amount: propina, provider_detail: det.montos.detalle }).eq("id", (k as any).id).then(() => {}, () => {});
      if (propina > 0 && (k as any).transaction_id) {
        const { data: tx } = await supabase.from("transactions").select("tip_amount").eq("id", (k as any).transaction_id).maybeSingle();
        if (!Number((tx as any)?.tip_amount)) {
          await supabase.from("transactions").update({ tip_amount: propina }).eq("id", (k as any).transaction_id);
          await supabase.from("audit_log").insert({ action: "transaction_tip", entity_type: "transaction", entity_id: (k as any).transaction_id, description: `Propina $${propina.toLocaleString("es-CL")} leída de ${term.proveedor === "tuu" ? "TUU" : "Mercado Pago"} (pago del tótem)`, metadata: { propina, pagado, kioskPaymentId: (k as any).id } }).then(() => {}, () => {});
          estado = "propina_registrada";
        } else estado = "ya_tenia_propina";
      }
    }
    filas.push({ ...base, pagado, propina, estado });
  }
  return NextResponse.json({ ok: true, aplicar, dias, total: filas.length, conPropina: filas.filter((f) => (f.propina || 0) > 0).length, filas });
}
