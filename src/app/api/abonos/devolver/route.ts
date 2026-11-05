import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, requireTenantRole } from "@/lib/supabase/server";
import { cargarCredencialAbono } from "@/lib/deposit";
import { sePuedeDevolver } from "@/lib/abonos";

export const dynamic = "force-dynamic";

// Devolver un abono (devolución total en Mercado Pago, con la cuenta del negocio). Solo administrador, solo abonos de su negocio.
// Opcionalmente cancela también la cita. Es seguro repetirlo: Mercado Pago recibe una clave de idempotencia por pago.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({} as any));
  const guard = await requireTenantRole(["admin", "super_admin"], body.tenantId);
  if (!guard.ok) return guard.response;
  const paymentId = String(body.paymentId || "");
  if (!/^\d{4,20}$/.test(paymentId)) return NextResponse.json({ error: "Pago no válido" }, { status: 400 });

  const sb = createAdminSupabase();
  const { data: dep } = await sb.from("booking_deposits").select("payment_id, appointment_id, amount, status").eq("tenant_id", guard.tenantId).eq("payment_id", paymentId).maybeSingle();
  if (!dep) return NextResponse.json({ error: "No encontré ese abono en tu negocio" }, { status: 404 });
  if (!sePuedeDevolver(dep.status)) return NextResponse.json({ error: dep.status === "refunded" ? "Este abono ya fue devuelto" : "Este pago no fue aprobado, no hay nada que devolver" }, { status: 409 });

  const cred = await cargarCredencialAbono(sb, guard.tenantId);
  if (!cred.token) return NextResponse.json({ error: "Este negocio no tiene una cuenta de Mercado Pago conectada" }, { status: 400 });
  let res: Response;
  try {
    res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}/refunds`, { method: "POST", headers: { Authorization: `Bearer ${cred.token}`, "Content-Type": "application/json", "X-Idempotency-Key": `rebooking-refund-${paymentId}` }, body: JSON.stringify({}) });
  } catch { return NextResponse.json({ error: "No pude comunicarme con Mercado Pago. Intenta de nuevo." }, { status: 502 }); }
  const d: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = String(d?.message || d?.error || "").toLowerCase();
    const yaDevuelto = /already|refunded|ya fue|fully/.test(msg);
    if (!yaDevuelto) return NextResponse.json({ error: `Mercado Pago no pudo devolver el abono${d?.message ? `: ${String(d.message).slice(0, 200)}` : ""}. Si el dinero ya salió de tu saldo, devuélvelo desde Mercado Pago › Actividad.` }, { status: 502 });
  }

  await sb.from("booking_deposits").update({ status: "refunded" }).eq("tenant_id", guard.tenantId).eq("payment_id", paymentId);
  let citaCancelada = false;
  if (dep.appointment_id) {
    await sb.from("appointments").update({ deposit_status: "refunded", ...(body.cancelarCita ? { status: "cancelled" } : {}) }).eq("id", dep.appointment_id).eq("tenant_id", guard.tenantId);
    citaCancelada = !!body.cancelarCita;
  }
  await sb.from("audit_log").insert({ action: "deposit_refunded", entity_type: "appointment", entity_id: dep.appointment_id || "", description: `Abono $${Number(dep.amount).toLocaleString("es-CL")} devuelto${citaCancelada ? " y cita cancelada" : ""}`, user_name: "administrador", metadata: { paymentId } }).then(() => {}, () => {});
  return NextResponse.json({ success: true, citaCancelada });
}
