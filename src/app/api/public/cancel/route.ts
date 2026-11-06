import { apptNoticeUrl, apptDayLabel } from "@/lib/appt-link";
import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";
import { notify } from "@/lib/notify";
import { motivoValido, limpiarNota, NOTA_MINIMA, aHoraPared } from "@/lib/cancel-reasons";
import { getPlazoCambios, aunSePuedeCambiar, textoPlazo } from "@/lib/cambio-cliente";

// Negocio de la cita (nombre y enlace de reserva) para que la página de cancelar mande al cliente a reagendar en SU negocio.
// Solo devuelve datos públicos del negocio de esa cita; nunca de otros.
async function negocioDeCita(supabase: any, appointmentId: string) {
  const { data } = await supabase.from("appointments").select("tenant_id").eq("id", appointmentId).maybeSingle();
  const tid = (data as any)?.tenant_id;
  if (!tid) return null;
  const { data: t } = await supabase.from("tenants").select("name, slug").eq("id", tid).maybeSingle();
  return t ? { name: (t as any).name as string, slug: (t as any).slug as string } : null;
}

export async function GET(req: NextRequest) {
  const id = new URL(req.url).searchParams.get("id") || "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ negocio: null });
  return NextResponse.json({ negocio: await negocioDeCita(createAdminSupabase(), id) });
}

// POST: Cancel an appointment by ID (public, no auth needed - uses appointment ID as token)
export async function POST(req: NextRequest) {
  const supabase = createAdminSupabase();
  const { appointmentId, reason, channel, note } = await req.json();

  if (!appointmentId) {
    return NextResponse.json({ error: "appointmentId requerido" }, { status: 400 });
  }

  // Si el cliente elige «Otro motivo», debe contar cuál (el motivo en sí es opcional).
  if (motivoValido(reason) === "otro" && (limpiarNota(note) || "").length < NOTA_MINIMA) {
    return NextResponse.json({ error: `Cuéntanos brevemente cuál fue el motivo (al menos ${NOTA_MINIMA} letras) o elige otra opción.` }, { status: 400 });
  }

  // Get appointment
  const { data: appt } = await supabase
    .from("appointments")
    .select("id, status, date, start_time, client_id, barber_id, tenant_id, client:clients(name)")
    .eq("id", appointmentId)
    .single();

  if (!appt) {
    return NextResponse.json({ error: "Cita no encontrada" }, { status: 404 });
  }

  // Only allow cancellation of scheduled/confirmed appointments
  if (!["scheduled", "confirmed"].includes(appt.status)) {
    return NextResponse.json({ error: "Esta cita ya no puede ser cancelada" }, { status: 400 });
  }

  // Plazo que definió el negocio (por defecto 2 horas). La hora de la cita está guardada como hora de pared de Chile,
  // así que «ahora» también se pasa a hora de pared antes de comparar.
  const plazo = await getPlazoCambios(supabase, appt.tenant_id);
  if (!aunSePuedeCambiar(String(appt.start_time), aHoraPared(new Date()), plazo)) {
    return NextResponse.json({ error: `Ya no se puede cancelar: el plazo es hasta ${textoPlazo(plazo)} antes de la hora. Escríbenos y te ayudamos.` }, { status: 400 });
  }

  // Cancel the appointment
  const { error } = await supabase
    .from("appointments")
    .update({ status: "cancelled" })
    .eq("id", appointmentId);

  if (error) {
    return NextResponse.json({ error: "Error al cancelar" }, { status: 500 });
  }
  // Quién canceló y por qué (migración 136); si aún no está aplicada, la cancelación ya quedó guardada.
  await supabase.from("appointments")
    .update({ cancelled_by: "client", cancel_reason: motivoValido(reason), cancelled_at: new Date().toISOString() })
    .eq("id", appointmentId);
  if (motivoValido(reason) === "otro" && limpiarNota(note)) await supabase.from("appointments").update({ cancel_note: limpiarNota(note) }).eq("id", appointmentId);
  // Por dónde entró el cliente (migración 138); aparte para que no afecte el registro de arriba si aún falta.
  await supabase.from("appointments").update({ cancel_channel: channel === "portal" ? "portal" : "link" }).eq("id", appointmentId);

  // Aviso al profesional (y recepcion/admin) de que el cliente cancelo. Nunca rompe la cancelacion.
  try {
    const a: any = appt;
    const hhmm = String(a.start_time || "").match(/(\d{2}:\d{2})/)?.[1] || "";
    const who = (Array.isArray(a.client) ? a.client[0]?.name : a.client?.name) || "Un cliente";
    await notify({
      tenantId: a.tenant_id, kind: "appointment_changed", professionalId: a.barber_id || null,
      userIds: a.barber_id ? [a.barber_id] : [], roles: ["admin", "receptionist"],
      title: "😕 Se canceló una cita",
      body: `${who} canceló${hhmm ? ` su hora del ${apptDayLabel(String(a.date))} a las ${hhmm}` : " su cita"}. El espacio quedó libre.`,
      url: apptNoticeUrl(appointmentId, String(a.date).slice(0, 10)),
    });
  } catch (e) {
    console.error("aviso de cancelacion:", e);
  }

  return NextResponse.json({ success: true, message: "Cita cancelada exitosamente", negocio: await negocioDeCita(supabase, appointmentId).catch(() => null) });
}
