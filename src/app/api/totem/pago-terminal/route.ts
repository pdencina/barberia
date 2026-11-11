import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";
import { negocioDelTotem, normalizarCodigo, soloDiaDelTotem, primerNombre, demasiadosIntentos, ipDe } from "@/lib/totem";
import { saldoCita } from "@/lib/totem-pago";
import { resolverTerminal, iniciarCobro, cancelarCobro } from "@/lib/totem-terminal";
import { notify } from "@/lib/notify";

// POST {codigo, appointmentId, code, tarjeta?: "debito"|"credito"}: manda el cobro del saldo de la cita a la MÁQUINA de tarjetas
// (Mercado Pago Point o TUU). Solo si el negocio activó «Cobro en la máquina» (apagado por defecto). El monto sale del servidor.
// La máquina es la PERSONAL del profesional de la cita si trabaja en arriendo y tiene la suya (como el POS); si no, la del negocio.
// Opción A: al aprobarse se avisa al profesional y a administración; la venta la registra el equipo en el POS.
export async function POST(req: NextRequest) {
  if (demasiadosIntentos(`pagoterm:${ipDe(req)}`, 8)) return NextResponse.json({ error: "Muchos intentos. Espera un momento." }, { status: 429 });
  const supabase = createAdminSupabase();
  const body = await req.json().catch(() => ({}));
  const t = await negocioDelTotem(supabase, body.codigo);
  if (!t) return NextResponse.json({ error: "Tótem no disponible" }, { status: 404 });
  if (!t.kiosk_terminal_enabled) return NextResponse.json({ error: "El cobro en la máquina no está activado en este local." }, { status: 403 });

  const code = normalizarCodigo(body.code);
  if (!body.appointmentId || code.length !== 5) return NextResponse.json({ error: "Falta el código" }, { status: 400 });
  const { data: a } = await soloDiaDelTotem(supabase.from("appointments").select("id, status, checkin_code, barber_id").eq("id", body.appointmentId).eq("tenant_id", t.id)).maybeSingle();
  if (!a || (a as any).checkin_code !== code || !["scheduled", "confirmed", "in_progress", "completed"].includes((a as any).status)) {
    return NextResponse.json({ error: "No encontramos tu cita" }, { status: 404 });
  }

  const s = await saldoCita(supabase, (a as any).id);
  if (!s || s.saldo <= 0) return NextResponse.json({ error: s && s.total > 0 ? "Tu cita ya está pagada con el abono." : "Esta cita no tiene un monto para cobrar. Avisa a quien te atiende." }, { status: 400 });

  const { data: pagado } = await supabase.from("kiosk_payments").select("id").eq("appointment_id", (a as any).id).eq("status", "paid").limit(1).maybeSingle();
  if (pagado) return NextResponse.json({ error: "Esta cita ya fue pagada desde el tótem." }, { status: 409 });

  const term = await resolverTerminal(supabase, t.id, (a as any).barber_id);
  if (!term) return NextResponse.json({ error: "Tu profesional no tiene una máquina de tarjetas conectada. Elige pagar en caja y avisamos al equipo." }, { status: 400 });

  // Una máquina atiende un cobro a la vez (cada profesional en arriendo tiene la suya): si ESA máquina tiene otro cobro pendiente
  // hace menos de 3 minutos (de otra cita) se pide esperar. Si el pendiente es de esta misma cita (el cliente reintentó), se cancela y se crea uno nuevo.
  const hace3 = new Date(Date.now() - 3 * 60_000).toISOString();
  const { data: pendientes } = await supabase.from("kiosk_payments").select("id, appointment_id, external_id").eq("tenant_id", t.id).eq("method", "terminal").eq("device", term.device).eq("status", "pending").gte("created_at", hace3);
  for (const p of pendientes || []) {
    if ((p as any).appointment_id !== (a as any).id) return NextResponse.json({ error: "La máquina está atendiendo a otra persona. Intenta en un momento." }, { status: 409 });
    if ((p as any).external_id) await cancelarCobro(term, (p as any).external_id);
    await supabase.from("kiosk_payments").update({ status: "cancelled" }).eq("id", (p as any).id);
  }

  const { data: kp, error } = await supabase.from("kiosk_payments").insert({ tenant_id: t.id, appointment_id: (a as any).id, amount: s.saldo, method: "terminal", provider: term.proveedor, device: term.device }).select("id").single();
  if (error || !kp) return NextResponse.json({ error: "No pudimos crear el cobro. Avisa a quien te atiende." }, { status: 500 });

  const r = await iniciarCobro(term, { amount: s.saldo, descripcion: `Servicio - ${t.name}`, referencia: `kt-${(kp as any).id}`, tarjeta: body.tarjeta === "credito" ? "credito" : "debito" });
  if (!r.ok) {
    await supabase.from("kiosk_payments").update({ status: "failed" }).eq("id", (kp as any).id);
    return NextResponse.json({ error: r.error }, { status: 502 });
  }
  await supabase.from("kiosk_payments").update({ external_id: r.externalId }).eq("id", (kp as any).id);

  // Si el cobro salió a la máquina PERSONAL del profesional, se le avisa a él para que la tenga a mano.
  let profesional: string | null = null;
  if (term.personal && term.barberId) {
    const { data: pro } = await supabase.from("profiles").select("name").eq("id", term.barberId).maybeSingle();
    profesional = (pro as any)?.name || null;
    const { data: cl } = await supabase.from("appointments").select("client:clients(name)").eq("id", (a as any).id).maybeSingle();
    await notify({
      tenantId: t.id, kind: "kiosk_payment", userIds: [term.barberId], professionalId: term.barberId,
      title: "Cobro enviado a tu máquina",
      body: `${primerNombre((cl as any)?.client?.name) || "Un cliente"} va a pagar $${s.saldo.toLocaleString("es-CL")} con tarjeta en tu máquina (desde el tótem).`,
      url: "/dashboard/mi-agenda",
    }).catch(() => {});
  }
  return NextResponse.json({ ok: true, id: (kp as any).id, monto: s.saldo, abono: s.abono, proveedor: term.proveedor, profesional });
}
