import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";
import { negocioDelTotem, normalizarCodigo, soloDiaDelTotem, demasiadosIntentos, ipDe } from "@/lib/totem";
import { saldoCita } from "@/lib/totem-pago";
import { resolverTerminal, iniciarCobro, cancelarCobro } from "@/lib/totem-terminal";

// POST {codigo, appointmentId, code, tarjeta?: "debito"|"credito"}: manda el cobro del saldo de la cita a la MÁQUINA de tarjetas del local
// (Mercado Pago Point o TUU). Solo si el negocio activó «Cobro en la máquina» (apagado por defecto). El monto sale del servidor.
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
  const { data: a } = await soloDiaDelTotem(supabase.from("appointments").select("id, status, checkin_code").eq("id", body.appointmentId).eq("tenant_id", t.id)).maybeSingle();
  if (!a || (a as any).checkin_code !== code || !["scheduled", "confirmed", "in_progress", "completed"].includes((a as any).status)) {
    return NextResponse.json({ error: "No encontramos tu cita" }, { status: 404 });
  }

  const s = await saldoCita(supabase, (a as any).id);
  if (!s || s.saldo <= 0) return NextResponse.json({ error: s && s.total > 0 ? "Tu cita ya está pagada con el abono." : "Esta cita no tiene un monto para cobrar. Avisa a quien te atiende." }, { status: 400 });

  const { data: pagado } = await supabase.from("kiosk_payments").select("id").eq("appointment_id", (a as any).id).eq("status", "paid").limit(1).maybeSingle();
  if (pagado) return NextResponse.json({ error: "Esta cita ya fue pagada desde el tótem." }, { status: 409 });

  const term = await resolverTerminal(supabase, t.id);
  if (!term) return NextResponse.json({ error: "La máquina de tarjetas aún no está conectada. Avisa a quien te atiende." }, { status: 400 });

  // Una máquina atiende un cobro a la vez: si hay otro pendiente hace menos de 3 minutos (de otra cita) se pide esperar.
  // Si el pendiente es de ESTA misma cita (el cliente volvió a intentar), se cancela y se crea uno nuevo.
  const hace3 = new Date(Date.now() - 3 * 60_000).toISOString();
  const { data: pendientes } = await supabase.from("kiosk_payments").select("id, appointment_id, external_id").eq("tenant_id", t.id).eq("method", "terminal").eq("status", "pending").gte("created_at", hace3);
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
  return NextResponse.json({ ok: true, id: (kp as any).id, monto: s.saldo, abono: s.abono, proveedor: term.proveedor });
}
