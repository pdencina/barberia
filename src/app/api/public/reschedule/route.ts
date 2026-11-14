import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";
import { publicAvailability } from "@/lib/public-availability";
import { isSlotFull } from "@/lib/capacity";
import { aHoraPared } from "@/lib/cancel-reasons";
import { aunSePuedeCambiar, getPlazoCambios, textoPlazo } from "@/lib/cambio-cliente";
import { parseWallClock } from "@/lib/wallclock";
import { emailClientAboutAppointment } from "@/lib/appointment-client-email";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });

// Igual que /public/cancel: el UUID del enlace del correo es la autorización pública.
// Negocio, profesional y duración salen de la cita; nunca del navegador.
async function load(supabase: any, id: unknown) {
  if (typeof id !== "string" || !UUID.test(id)) return { response: fail("Enlace de cita inválido") };
  const { data: a, error } = await supabase.from("appointments")
    .select("id, tenant_id, barber_id, date, start_time, end_time, status")
    .eq("id", id).maybeSingle();
  if (error) return { response: fail("No se pudo consultar la cita", 503) };
  if (!a?.tenant_id || !a.barber_id) return { response: fail("Cita no encontrada", 404) };
  if (!["scheduled", "confirmed"].includes(a.status)) return { response: fail("Esta cita ya no se puede modificar") };
  const plazo = await getPlazoCambios(supabase, a.tenant_id);
  if (!aunSePuedeCambiar(a.start_time, aHoraPared(new Date()), plazo)) {
    return { response: fail(`El plazo para cambiar es hasta ${textoPlazo(plazo)} antes de la cita. Contacta al negocio.`) };
  }
  const duration = (parseWallClock(a.end_time).getTime() - parseWallClock(a.start_time).getTime()) / 60000;
  if (!Number.isInteger(duration) || duration <= 0 || duration > 1440) return { response: fail("Contacta al negocio para cambiar esta cita") };
  const { data: professional, error: profileError } = await supabase.from("profiles").select("id")
    .eq("id", a.barber_id).eq("tenant_id", a.tenant_id).eq("active", true).maybeSingle();
  if (profileError || !professional) return { response: fail("El profesional no está disponible. Contacta al negocio.") };
  return { a, duration };
}

function validDate(date: unknown): date is string {
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const d = parseWallClock(`${date}T00:00:00`);
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === date;
}
async function slots(req: NextRequest, a: any, date: string, duration: number) {
  const url = new URL("/api/public/availability", req.url);
  url.search = new URLSearchParams({ barberId: a.barber_id, date, duration: String(duration) }).toString();
  return publicAvailability(new NextRequest(url), { appointmentId: a.id, tenantId: a.tenant_id });
}

export async function GET(req: NextRequest) {
  const q = new URL(req.url).searchParams;
  const loaded = await load(createAdminSupabase(), q.get("id"));
  if (loaded.response) return loaded.response;
  const { a, duration } = loaded;
  const date = q.get("date");
  if (!date) return NextResponse.json({ start: a.start_time, date: a.date }, { headers: { "Cache-Control": "no-store" } });
  if (!validDate(date)) return fail("Fecha inválida");
  if (date < aHoraPared(new Date()).toISOString().slice(0, 10)) return NextResponse.json({ slots: [] });
  const response = await slots(req, a, date, duration!);
  if (!response.ok) return response;
  return NextResponse.json(await response.json(), { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest) {
  let body: any;
  try { body = await req.json(); } catch { return fail("Solicitud inválida"); }
  if (!body || typeof body !== "object") return fail("Solicitud inválida");
  const { appointmentId, date, start, expectedStart } = body;
  if (!validDate(date) || typeof start !== "string" || !new RegExp(`^${date}T\\d{2}:\\d{2}:00$`).test(start)) return fail("Fecha u hora inválida");
  if (!(parseWallClock(start).getTime() > aHoraPared(new Date()).getTime())) return fail("Elige una hora futura");
  const supabase = createAdminSupabase();
  const loaded = await load(supabase, appointmentId);
  if (loaded.response) return loaded.response;
  const { a, duration } = loaded;
  if (expectedStart !== a.start_time) return fail("La cita cambió. Recarga el enlace antes de continuar.", 409);
  const available = await slots(req, a, date, duration!);
  if (!available.ok) return available;
  const data = await available.json();
  if (!Array.isArray(data.slots) || !data.slots.includes(start)) return fail("Esa hora ya no está disponible. Elige otra.", 409);
  const end = new Date(parseWallClock(start).getTime() + duration! * 60000).toISOString();
  // Segunda revision justo antes de guardar: otra persona pudo tomar esa hora mientras esta elegia (sin contar la propia cita).
  if (await isSlotFull(supabase, a.barber_id, a.tenant_id, date, parseWallClock(start), new Date(end), a.id)) return fail("Esa hora ya no está disponible. Elige otra.", 409);
  // Solo se cambia la hora de LA MISMA cita. No se cancela, no se crea otra reserva,
  // no se escriben abonos, descuentos, servicios ni pagos, ni se invoca al proveedor de cobros.
  const { data: saved, error } = await supabase.from("appointments")
    .update({ date, start_time: `${start}Z`, end_time: end, reminder_sent: false, reminder_sent_at: null })
    .eq("id", a.id).eq("tenant_id", a.tenant_id).eq("barber_id", a.barber_id)
    .eq("status", a.status).eq("start_time", a.start_time).eq("end_time", a.end_time)
    .select("id").maybeSingle();
  if (error) return fail("No se pudo cambiar la hora. Tu reserva anterior se conserva.", 409);
  if (!saved) return fail("La cita cambió. Recarga el enlace antes de continuar.", 409);
  try { await emailClientAboutAppointment(supabase, a.id, "updated"); } catch { /* El cambio guardado sigue siendo válido si falla el correo. */ }
  return NextResponse.json({ ok: true, start, date });
}
