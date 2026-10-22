import { parseWallClock } from "@/lib/wallclock";
import { tryConsumeQuota } from "@/lib/message-quota";
import { cleanClientName } from "@/lib/client-name";

// Aviso por correo al CLIENTE cuando el equipo crea o cambia su cita desde el calendario.
// (Las reservas que hace el propio cliente por la pagina publica ya envian su confirmacion en /api/public/book.)

const isValidEmail = (e: unknown): e is string => typeof e === "string" && /^\S+@\S+\.\S+$/.test(e.trim());
const ACTIVE_STATUSES = ["scheduled", "confirmed", "in_progress"];

export type ClientChangeReason = "hora" | "profesional" | "servicios";

/**
 * Que cambio de la cita le importa al cliente. Solo cuenta mover la hora de INICIO, cambiar de profesional o cambiar los servicios;
 * estirar o achicar el bloque en el calendario, notas internas y cambios de estado NO generan correo (evita avisos de mas).
 * Las horas se comparan como "hora de pared": el valor de la base ("...+00:00") y el que manda el calendario ("...T10:00:00") son la misma.
 */
export function clientVisibleChanges(args: {
  before: { start_time: string | null; barber_id: string | null; serviceIds: string[] };
  after: { start_time?: string | null; barber_id?: string | null; serviceIds?: string[] | null };
}): ClientChangeReason[] {
  const { before, after } = args;
  const reasons: ClientChangeReason[] = [];
  if (after.start_time && before.start_time) {
    const a = parseWallClock(after.start_time).getTime();
    const b = parseWallClock(before.start_time).getTime();
    if (Number.isFinite(a) && Number.isFinite(b) && a !== b) reasons.push("hora");
  }
  if (after.barber_id && before.barber_id && after.barber_id !== before.barber_id) reasons.push("profesional");
  if (after.serviceIds && after.serviceIds.length > 0) {
    const x = Array.from(new Set(before.serviceIds)).sort().join(",");
    const y = Array.from(new Set(after.serviceIds)).sort().join(",");
    if (x !== y) reasons.push("servicios");
  }
  return reasons;
}

export type ClientEmailResult = "enviado" | "sin_correo" | "sin_cupo" | "no_aplica";

/**
 * Envia al cliente de la cita el correo de "Cita confirmada" (kind "created") o "Cita modificada" (kind "updated"),
 * con los datos ACTUALES de la cita. No envia si la cita no tiene cliente, el cliente no tiene correo valido o la cita ya no esta activa.
 * Respeta el cupo mensual de correos del plan, igual que la confirmacion de la reserva publica.
 */
export async function emailClientAboutAppointment(supabase: any, appointmentId: string, kind: "created" | "updated"): Promise<ClientEmailResult> {
  const { data: a } = await supabase
    .from("appointments")
    .select("id, start_time, end_time, status, tenant_id, client:clients(name, email), barber:profiles(name), services:appointment_services(price, service:services(name, duration))")
    .eq("id", appointmentId)
    .maybeSingle();
  if (!a || !a.client) return "no_aplica";
  if (!ACTIVE_STATUSES.includes(a.status)) return "no_aplica";
  if (!isValidEmail(a.client.email)) return "sin_correo";

  const rows: any[] = a.services || [];
  const serviceName = rows.map((r) => r.service?.name).filter(Boolean).join(" + ") || "Servicio";
  const price = rows.reduce((n, r) => n + Number(r.price || 0), 0);
  const start = parseWallClock(a.start_time);
  const minutes = Math.round((parseWallClock(a.end_time).getTime() - start.getTime()) / 60000);
  const duration = Number.isFinite(minutes) && minutes > 0 ? minutes : rows.reduce((n, r) => n + Number(r.service?.duration || 0), 0);

  if (a.tenant_id && !(await tryConsumeQuota(a.tenant_id, "email", "confirmation", appointmentId))) {
    console.warn(`Cupo de correos agotado para tenant ${a.tenant_id}, no se avisa al cliente de la cita ${appointmentId}`);
    return "sin_cupo";
  }

  const { data: tenant } = a.tenant_id ? await supabase.from("tenants").select("logo_url").eq("id", a.tenant_id).maybeSingle() : { data: null };
  const params = {
    to: a.client.email.trim(),
    clientName: cleanClientName(a.client.name) || "Cliente",
    barberName: a.barber?.name || "Tu profesional",
    serviceName,
    date: start,
    duration,
    price,
    appointmentId,
    businessLogoUrl: tenant?.logo_url || null,
  };
  const { sendBookingConfirmation, sendAppointmentUpdated } = await import("@/lib/resend");
  if (kind === "created") await sendBookingConfirmation(params);
  else await sendAppointmentUpdated(params);
  return "enviado";
}
