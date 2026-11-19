import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";
import { negocioDelTotem, normalizarCodigo, soloDiaDelTotem, primerNombre, demasiadosIntentos, ipDe } from "@/lib/totem";
import { leerServiciosPublicos } from "@/lib/servicios-internos";
import { notify } from "@/lib/notify";

// POST {codigo, code, appointmentId, serviceIds?}: el cliente agrega o cambia los servicios de SU cita de hoy, antes de pagar (ej. de «corte» a «corte + cejas»).
//  - Sin serviceIds: devuelve los servicios que ese profesional ofrece (con SU precio) y los que ya tiene la cita.
//  - Con serviceIds: reemplaza los servicios de la cita. Precios y duración salen SIEMPRE del servidor.
// Se bloquea si la cita ya tiene un cobro pagado o en curso. La hora de término solo se alarga si no choca con la siguiente cita
// (el profesional guía la atención igual).
export async function POST(req: NextRequest) {
  if (demasiadosIntentos(`citasvc:${ipDe(req)}`, 20)) return NextResponse.json({ error: "Muchos intentos. Espera un momento." }, { status: 429 });
  const supabase = createAdminSupabase();
  const body = await req.json().catch(() => ({}));
  const t = await negocioDelTotem(supabase, body.codigo);
  if (!t) return NextResponse.json({ error: "Tótem no disponible" }, { status: 404 });

  const code = normalizarCodigo(body.code);
  const id = String(body.appointmentId || "");
  if (code.length !== 5 || !/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Falta el código" }, { status: 400 });
  const { data: a } = await soloDiaDelTotem(supabase.from("appointments").select("id, status, checkin_code, barber_id, date, start_time, end_time, client:clients(name)").eq("id", id).eq("tenant_id", t.id)).maybeSingle();
  if (!a || (a as any).checkin_code !== code || !["scheduled", "confirmed", "in_progress"].includes((a as any).status)) {
    return NextResponse.json({ error: "No encontramos tu cita" }, { status: 404 });
  }

  // Con un cobro pagado o en curso ya no se puede cambiar (el monto ya se mandó a la máquina o al QR).
  const hace15 = new Date(Date.now() - 15 * 60_000).toISOString();
  const { data: cobros } = await supabase.from("kiosk_payments").select("id, status, created_at").eq("tenant_id", t.id).or(`appointment_id.eq.${id},appointment_ids.cs.{${id}}`).in("status", ["paid", "pending"]);
  if ((cobros || []).some((c: any) => c.status === "paid" || c.created_at >= hace15)) {
    return NextResponse.json({ error: "Esta cita ya tiene un pago en curso. Avisa a quien te atiende para cambiarla." }, { status: 409 });
  }

  // Servicios que ofrece el profesional, con su precio y duración propios (igual que en la reserva).
  const barberId = (a as any).barber_id as string;
  const { data: servicios } = await leerServiciosPublicos((cols) => supabase.from("services").select(cols).eq("active", true).eq("tenant_id", t.id).order("sort_order"), "id, name, price, duration, sort_order");
  const { data: propios } = await supabase.from("barber_services").select("service_id, custom_price, custom_duration").eq("barber_id", barberId);
  const { data: asignados } = await supabase.from("barber_service_assignments").select("service_id").eq("barber_id", barberId);
  const idsAsignados = (asignados || []).map((x: any) => x.service_id);
  const propiosMap = new Map((propios || []).map((c: any) => [c.service_id, c]));
  const ofrecidos = (servicios || [])
    .filter((s: any) => idsAsignados.length === 0 || idsAsignados.includes(s.id))
    .map((s: any) => {
      const c: any = propiosMap.get(s.id);
      return { id: s.id as string, name: s.name as string, price: c?.custom_price ? Number(c.custom_price) : Number(s.price), duration: Number(c?.custom_duration || s.duration) || 0 };
    });

  const { data: actualesFilas } = await supabase.from("appointment_services").select("service_id").eq("appointment_id", id);
  const actuales = (actualesFilas || []).map((x: any) => x.service_id as string);

  // Solo listar
  if (!Array.isArray(body.serviceIds)) return NextResponse.json({ servicios: ofrecidos, actuales });

  // Cambiar
  const pedidos: string[] = Array.from(new Set((body.serviceIds as unknown[]).map((x) => String(x || "")))).slice(0, 6);
  const elegidos = pedidos.map((sid) => ofrecidos.find((s) => s.id === sid)).filter(Boolean) as typeof ofrecidos;
  if (elegidos.length === 0 || elegidos.length !== pedidos.length) return NextResponse.json({ error: "Elige al menos un servicio válido" }, { status: 400 });

  // Primero se agregan los nuevos y luego se quitan los anteriores: si algo falla, la cita nunca queda sin servicios.
  const { data: viejos } = await supabase.from("appointment_services").select("id").eq("appointment_id", id);
  const { error: errIns } = await supabase.from("appointment_services").insert(elegidos.map((s) => ({ appointment_id: id, service_id: s.id, price: s.price })));
  if (errIns) return NextResponse.json({ error: "No pudimos cambiar el servicio. Avisa a quien te atiende." }, { status: 500 });
  if ((viejos || []).length) await supabase.from("appointment_services").delete().in("id", (viejos || []).map((v: any) => v.id));

  // Hora de término: se alarga o acorta solo si no choca con otra cita del profesional ese día.
  const dur = Math.max(5, elegidos.reduce((n, s) => n + s.duration, 0));
  const inicio = new Date((a as any).start_time);
  const nuevoFin = new Date(inicio.getTime() + dur * 60000);
  let finActualizado = false;
  try {
    const { data: choques } = await supabase.from("appointments").select("id").eq("tenant_id", t.id).eq("barber_id", barberId).eq("date", (a as any).date)
      .in("status", ["scheduled", "confirmed", "in_progress"]).neq("id", id).lt("start_time", nuevoFin.toISOString()).gt("end_time", inicio.toISOString()).limit(1);
    if (!(choques || []).length) { await supabase.from("appointments").update({ end_time: nuevoFin.toISOString() }).eq("id", id); finActualizado = true; }
  } catch { /* se deja la hora de término como estaba */ }

  const total = elegidos.reduce((n, s) => n + s.price, 0);
  const nombres = elegidos.map((s) => s.name).join(" + ");
  await supabase.from("audit_log").insert({
    action: "kiosk_service_change", entity_type: "appointment", entity_id: id,
    description: `Servicio cambiado desde el tótem: ${nombres} ($${total.toLocaleString("es-CL")})`,
    metadata: { tenantId: t.id, antes: actuales, despues: elegidos.map((s) => s.id), finActualizado },
  }).then(() => {}, () => {});
  await notify({
    tenantId: t.id, kind: "kiosk_payment", userIds: [barberId], professionalId: barberId,
    title: "Servicio cambiado desde el tótem",
    body: `${primerNombre((a as any).client?.name) || "Un cliente"} cambió su servicio a ${nombres} ($${total.toLocaleString("es-CL")}).`,
    url: "/dashboard/mi-agenda",
  }).catch(() => {});

  return NextResponse.json({ ok: true, total, servicios: elegidos, finActualizado });
}
