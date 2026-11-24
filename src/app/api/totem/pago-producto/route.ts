import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";
import { negocioDelTotem, primerNombre, demasiadosIntentos, ipDe, moduloDe } from "@/lib/totem";
import { armarCompraProductos, barberDeCobroProductos } from "@/lib/totem-producto";
import { resolverTerminal, iniciarCobro, tokensMercadoPago } from "@/lib/totem-terminal";
import { firmarNegocio } from "@/lib/deposit";
import { notify } from "@/lib/notify";

// POST {codigo, productos: [{id, cantidad}], code? | barberId?, medio: "terminal" | "qr", tarjeta?}: cobra una compra de PRODUCTOS hecha en el tótem.
// El profesional que vende es el de la cita de hoy del cliente (por su código) o el que el cliente elige; el cobro va a SU máquina (arriendo) o a la
// de la casa, y al aprobarse se registra la venta a su nombre (la comisión y el descuento de fin de mes los calcula el libro, como en el POS).
export async function POST(req: NextRequest) {
  if (demasiadosIntentos(`pagoprod:${ipDe(req)}`, 10)) return NextResponse.json({ error: "Muchos intentos. Espera un momento." }, { status: 429 });
  const supabase = createAdminSupabase();
  const body = await req.json().catch(() => ({}));
  const t = await negocioDelTotem(supabase, body.codigo);
  if (!t) return NextResponse.json({ error: "Tótem no disponible" }, { status: 404 });
  const medio = body.medio === "qr" ? "qr" : "terminal";
  if (medio === "terminal" && !t.kiosk_terminal_enabled) return NextResponse.json({ error: "El cobro en la máquina no está activado en este local." }, { status: 403 });
  if (medio === "qr" && !t.kiosk_pay_qr_enabled) return NextResponse.json({ error: "El pago por QR no está activado en este local." }, { status: 403 });

  const compra = await armarCompraProductos(supabase, t.id, { productos: body.productos, code: body.code, barberId: body.barberId });
  if (!compra.ok) return NextResponse.json({ error: compra.error, pedirProfesional: !!compra.pedirProfesional }, { status: compra.status });

  const fila = { ...(moduloDe(req) > 0 ? { module: moduloDe(req) } : {}), tenant_id: t.id, kind: "producto", barber_id: compra.vendedor?.id || null, client_id: compra.clienteId, items: compra.items, amount: compra.total };

  if (medio === "terminal") {
    // Bebidas/consumibles nunca van a la máquina del profesional: solo un carrito 100% cosmético usa la suya.
    const term = await resolverTerminal(supabase, t.id, barberDeCobroProductos(compra.items, compra.vendedor?.id || null));
    if (!term) return NextResponse.json({ error: "Esa máquina de tarjetas no está conectada. Elige pagar en caja y avisamos al equipo." }, { status: 400 });
    const hace3 = new Date(Date.now() - 3 * 60_000).toISOString();
    // Solo cuenta el cobro pendiente de OTRO módulo con la misma máquina física; uno del mismo módulo es de alguien que ya se fue.
    let qOcupada: any = supabase.from("kiosk_payments").select("id").eq("tenant_id", t.id).eq("method", "terminal").eq("device", term.device).eq("status", "pending").gte("created_at", hace3);
    if (moduloDe(req) > 0) qOcupada = qOcupada.or(`module.is.null,module.neq.${moduloDe(req)}`);
    const { data: ocupada } = await qOcupada.limit(1).maybeSingle();
    if (ocupada) return NextResponse.json({ error: "La máquina está atendiendo a otra persona. Intenta en un momento." }, { status: 409 });

    const card_type = body.tarjeta === "credito" ? "credito" : "debito";
    let ins: any = await supabase.from("kiosk_payments").insert({ ...fila, method: "terminal", provider: term.proveedor, device: term.device, card_type }).select("id").single();
    if (ins.error || !ins.data) return NextResponse.json({ error: "No pudimos crear el cobro. Avisa a quien te atiende." }, { status: 500 });
    const kpId = ins.data.id as string;
    const r = await iniciarCobro(term, { amount: compra.total, descripcion: `Productos - ${t.name}`, referencia: `kt-${kpId}`, tarjeta: card_type });
    if (!r.ok) {
      await supabase.from("kiosk_payments").update({ status: "failed" }).eq("id", kpId);
      return NextResponse.json({ error: r.error }, { status: 502 });
    }
    await supabase.from("kiosk_payments").update({ external_id: r.externalId }).eq("id", kpId);
    if (term.personal && term.barberId) {
      await notify({ tenantId: t.id, kind: "kiosk_payment", userIds: [term.barberId], professionalId: term.barberId, title: "Cobro de productos enviado a tu máquina", body: `Un cliente va a pagar $${compra.total.toLocaleString("es-CL")} en productos con tarjeta en tu máquina (desde el tótem).`, url: "/dashboard/mi-agenda" }).catch(() => {});
    }
    return NextResponse.json({ ok: true, id: kpId, monto: compra.total, abono: 0, proveedor: term.proveedor, profesional: term.personal ? compra.vendedor?.name || null : null, vendedor: compra.vendedor?.name || null });
  }

  // QR de Mercado Pago: a la cuenta del profesional (si es de arriendo y tiene la suya) o a la del negocio.
  const token = (await tokensMercadoPago(supabase, t.id, barberDeCobroProductos(compra.items, compra.vendedor?.id || null)))[0] || null;
  if (!token) return NextResponse.json({ error: "Mercado Pago no está conectado para esta venta. Elige pagar en caja y avisamos al equipo." }, { status: 400 });
  const ins: any = await supabase.from("kiosk_payments").insert({ ...fila, method: "qr" }).select("id").single();
  if (ins.error || !ins.data) return NextResponse.json({ error: "No pudimos crear el pago. Avisa a quien te atiende." }, { status: 500 });
  const kpId = ins.data.id as string;
  const baseUrl = (process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "https://www.re-booking.cl").replace(/\/$/, "");
  const res = await fetch("https://api.mercadopago.com/checkout/preferences", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      items: [{ title: `Productos - ${t.name}`, quantity: 1, currency_id: "CLP", unit_price: compra.total }],
      back_urls: { success: `${baseUrl}/pago-recibido?status=success`, failure: `${baseUrl}/pago-recibido?status=failure`, pending: `${baseUrl}/pago-recibido?status=pending` },
      auto_return: "approved",
      external_reference: `kp-${kpId}`,
      notification_url: `${baseUrl}/api/webhooks/kiosk-pay?t=${t.id}&s=${firmarNegocio(t.id)}`,
      statement_descriptor: String(t.name || "RE-BOOKING").slice(0, 22),
      expires: true,
      expiration_date_from: new Date().toISOString(),
      expiration_date_to: new Date(Date.now() + 10 * 60_000).toISOString(),
    }),
  });
  const pref = await res.json().catch(() => ({}));
  if (!res.ok || !pref?.init_point) {
    console.error("MP preference (tótem, productos) error:", pref);
    await supabase.from("kiosk_payments").update({ status: "failed" }).eq("id", kpId);
    return NextResponse.json({ error: "No pudimos crear el link de pago. Avisa a quien te atiende." }, { status: 502 });
  }
  await supabase.from("kiosk_payments").update({ mp_preference_id: String(pref.id || "") }).eq("id", kpId);
  return NextResponse.json({ ok: true, id: kpId, url: pref.init_point, monto: compra.total, abono: 0, vendedor: compra.vendedor?.name || null });
}
