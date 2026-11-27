import { bloqueoPorPromo } from "@/lib/cupon-cita";
import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";
import { negocioDelTotem, normalizarCodigo, soloDiaDelTotem, demasiadosIntentos, ipDe, moduloDe } from "@/lib/totem";
import { citasParaCobro, citasDeOtrasPersonas } from "@/lib/totem-citas";
import { armarItemsProductos } from "@/lib/totem-producto";
import { firmarNegocio } from "@/lib/deposit";
import { tokensMercadoPago } from "@/lib/totem-terminal";

// POST {codigo, appointmentId, code}: crea el link de pago de Mercado Pago (cuenta del NEGOCIO) por el saldo de la cita y lo devuelve
// para mostrarlo como QR en el totem. Solo si el negocio activo «Pago por QR» (apagado por defecto). El monto sale del servidor.
export async function POST(req: NextRequest) {
  if (demasiadosIntentos(`pagoqr:${ipDe(req)}`, 10)) return NextResponse.json({ error: "Muchos intentos. Espera un momento." }, { status: 429 });
  const supabase = createAdminSupabase();
  const body = await req.json().catch(() => ({}));
  const t = await negocioDelTotem(supabase, body.codigo);
  if (!t) return NextResponse.json({ error: "Totem no disponible" }, { status: 404 });
  if (!t.kiosk_pay_qr_enabled) return NextResponse.json({ error: "El pago por QR no está activado en este local." }, { status: 403 });

  // Una o varias citas del mismo cliente con el mismo profesional (appointmentIds); se valida y se suma todo en el servidor (y no se cobra dos veces).
  const cc = await citasParaCobro(supabase, t.id, body.code, Array.isArray(body.appointmentIds) ? body.appointmentIds : [body.appointmentId]);
  if (!cc.ok) return NextResponse.json({ error: cc.error }, { status: cc.status });
  const a = { id: cc.primeraId, barber_id: cc.barberId };
  // Productos (cosméticos) que el cliente agregó antes de pagar: se cobran junto al servicio, con precios del servidor.
  let extraItems: any[] | null = null;
  let extraTotal = 0;
  if (Array.isArray(body.productos) && body.productos.length) {
    const c = await armarItemsProductos(supabase, t.id, body.productos, true);
    if (!c.ok) return NextResponse.json({ error: c.error }, { status: c.status });
    extraItems = c.items; extraTotal = c.total;
  }
  // Otras personas que pagan en el mismo cobro (cada una con su código y su propia venta).
  const otras = await citasDeOtrasPersonas(supabase, t.id, cc, body.otros);
  if (!otras.ok) return NextResponse.json({ error: otras.error }, { status: otras.status });
  const s = { saldo: cc.saldo + otras.saldo + extraTotal, abono: cc.abono + otras.abono, total: cc.total + otras.total + extraTotal };
  const extraIds = [...cc.extraIds, ...otras.extraIds];
  // Reserva con promoción de «solo efectivo o transferencia»: no se cobra con tarjeta ni QR.
  const bloqueo = await bloqueoPorPromo(supabase, [cc.primeraId, ...extraIds], ["qr"]);
  if (bloqueo) {
    // Solo se manda a «Pagar en efectivo» si ese botón existe en este local.
    const { data: ef } = await supabase.from("tenants").select("kiosk_cash_enabled").eq("id", t.id).maybeSingle();
    return NextResponse.json({ error: `${bloqueo} ${(ef as any)?.kiosk_cash_enabled ? "Elige «Pagar en efectivo»." : "Paga en caja; el equipo te ayuda."}` }, { status: 409 });
  }

  // Cuenta de Mercado Pago a la que entra el pago: la del profesional de la cita si trabaja en arriendo (como el POS); si no, la del negocio.
  const cred = { token: (await tokensMercadoPago(supabase, t.id, (a as any).barber_id))[0] || null };
  if (!cred.token) return NextResponse.json({ error: "Tu profesional no tiene Mercado Pago conectado. Elige pagar en caja y avisamos al equipo." }, { status: 400 });

  const { data: pago, error: errIns } = await supabase.from("kiosk_payments").insert({ ...(extraItems ? { items: extraItems } : {}), tenant_id: t.id, appointment_id: (a as any).id, ...(extraIds.length ? { appointment_ids: extraIds } : {}), ...(moduloDe(req) > 0 ? { module: moduloDe(req) } : {}), amount: s.saldo }).select("id").single();
  if (errIns || !pago) return NextResponse.json({ error: "No pudimos crear el pago. Avisa a quien te atiende." }, { status: 500 });

  const baseUrl = (process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "https://www.re-booking.cl").replace(/\/$/, "");
  const vence = new Date(Date.now() + 10 * 60_000);
  const res = await fetch("https://api.mercadopago.com/checkout/preferences", {
    method: "POST",
    headers: { Authorization: `Bearer ${cred.token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      items: [{ title: `Servicio - ${t.name}`, quantity: 1, currency_id: "CLP", unit_price: s.saldo }],
      back_urls: { success: `${baseUrl}/pago-recibido?status=success`, failure: `${baseUrl}/pago-recibido?status=failure`, pending: `${baseUrl}/pago-recibido?status=pending` },
      auto_return: "approved",
      external_reference: `kp-${(pago as any).id}`,
      notification_url: `${baseUrl}/api/webhooks/kiosk-pay?t=${t.id}&s=${firmarNegocio(t.id)}`,
      statement_descriptor: String(t.name || "RE-BOOKING").slice(0, 22),
      expires: true,
      expiration_date_from: new Date().toISOString(),
      expiration_date_to: vence.toISOString(),
    }),
  });
  const pref = await res.json().catch(() => ({}));
  if (!res.ok || !pref?.init_point) {
    console.error("MP preference (totem) error:", pref);
    await supabase.from("kiosk_payments").update({ status: "failed" }).eq("id", (pago as any).id);
    return NextResponse.json({ error: "No pudimos crear el link de pago. Avisa a quien te atiende." }, { status: 502 });
  }
  await supabase.from("kiosk_payments").update({ mp_preference_id: String(pref.id || "") }).eq("id", (pago as any).id);
  return NextResponse.json({ ok: true, id: (pago as any).id, url: pref.init_point, monto: s.saldo, total: s.total, abono: s.abono });
}
