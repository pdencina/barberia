import { randomUUID } from "crypto";
import { blockConflict } from "@/lib/blocks";
import { getSlotCapacity, isSlotFull, exceededAfterInsert } from "@/lib/capacity";
import { isOnVacation } from "@/lib/vacations";
import { getWindowDays, isBeyondWindow } from "@/lib/booking-window";

// Mientras el cliente paga el abono, su horario queda bloqueado (la cita recien se crea cuando el pago se aprueba).
// El bloqueo vence solo a los 3 minutos: si no paga, el horario vuelve a estar libre.
export const HOLD_SEGUNDOS = 180; // 3 minutos: es lo que tiene el cliente para pagar; si no paga, el horario se libera y no queda nada bloqueado
const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

// ¿El horario sigue libre? (vacaciones, dias permitidos, bloqueos —incluidos los de otros que estan pagando— y citas).
export async function horarioDisponible(supabase: any, o: { barberId: string; tenantId: string | null; date: string; start: Date; end: Date }): Promise<{ ok: true } | { ok: false; error: string }> {
  const { barberId, tenantId, date, start, end } = o;
  if (await isOnVacation(supabase, barberId, date)) return { ok: false, error: "El profesional no atiende ese día. Selecciona otra fecha." };
  if (isBeyondWindow(date, await getWindowDays(supabase, tenantId))) return { ok: false, error: "Esa fecha todavía no está disponible para reservar." };
  let { data: blks, error } = (await supabase.from("barber_blocks").select("all_day, start_time, end_time, spots, hold_expires_at").eq("barber_id", barberId).eq("date", date)) as { data: any[] | null; error: any };
  if (error) ({ data: blks } = await supabase.from("barber_blocks").select("all_day, start_time, end_time, spots").eq("barber_id", barberId).eq("date", date));
  const vigentes = (blks || []).filter((b: any) => !b.hold_expires_at || Date.parse(b.hold_expires_at) > Date.now());
  const cap = await getSlotCapacity(supabase, tenantId);
  const c = blockConflict(vigentes, cap, start.getUTCHours() * 60 + start.getUTCMinutes(), end.getUTCHours() * 60 + end.getUTCMinutes());
  if (c === "day") return { ok: false, error: "El profesional no atiende ese día. Selecciona otra fecha." };
  if (c === "time") return { ok: false, error: "Ese horario ya no está disponible. Elige otro." };
  if (await isSlotFull(supabase, barberId, tenantId, date, start, end)) return { ok: false, error: "Ese horario ya no está disponible. Elige otro." };
  return { ok: true };
}

// Borra los bloqueos de pago vencidos (de un profesional y dia, o todos).
export async function limpiarHoldsVencidos(supabase: any, f?: { barberId?: string; date?: string }): Promise<void> {
  try {
    let q = supabase.from("barber_blocks").delete().lt("hold_expires_at", new Date().toISOString());
    if (f?.barberId) q = q.eq("barber_id", f.barberId);
    if (f?.date) q = q.eq("date", f.date);
    await q;
    if (!f) await supabase.from("booking_intents").delete().lt("created_at", new Date(Date.now() - 14 * 86400000).toISOString()); // reservas en espera de pago de hace mas de 14 dias
  } catch { /* sin las migraciones 132 / 133 no hay nada que limpiar */ }
}

// Bloquea el horario mientras se paga. Devuelve la referencia, o null si no se pudo (sin la migracion 132 todo sigue como antes, sin bloqueo).
export async function crearHold(supabase: any, o: { barberId: string; date: string; start: Date; end: Date }): Promise<{ ref: string; expira: Date } | null> {
  const ref = randomUUID();
  const expira = new Date(Date.now() + HOLD_SEGUNDOS * 1000);
  const { error } = await supabase.from("barber_blocks").insert({
    barber_id: o.barberId, date: o.date, all_day: false,
    start_time: hhmm(o.start.getUTCHours() * 60 + o.start.getUTCMinutes()), end_time: hhmm(o.end.getUTCHours() * 60 + o.end.getUTCMinutes()),
    reason: "Reserva en pago (abono)", hold_ref: ref, hold_expires_at: expira.toISOString(),
  });
  return error ? null : { ref, expira };
}

export async function liberarHold(supabase: any, ref: string | null | undefined): Promise<void> {
  if (!ref) return;
  try { await supabase.from("barber_blocks").delete().eq("hold_ref", ref); } catch { /* nada que liberar */ }
}

// Revision DESPUES de que el cliente pagó: solo importa si el horario sigue sin citas ni bloqueos (ya se validó vacaciones, ventana y dias al reservar;
// volver a exigirlas podia rechazar un pago legitimo).
export async function horarioLibreTrasPago(supabase: any, o: { barberId: string; tenantId: string | null; date: string; start: Date; end: Date }): Promise<boolean> {
  let { data: blks, error } = (await supabase.from("barber_blocks").select("all_day, start_time, end_time, spots, hold_expires_at").eq("barber_id", o.barberId).eq("date", o.date)) as { data: any[] | null; error: any };
  if (error) ({ data: blks } = await supabase.from("barber_blocks").select("all_day, start_time, end_time, spots").eq("barber_id", o.barberId).eq("date", o.date));
  const vigentes = (blks || []).filter((b: any) => !b.hold_expires_at || Date.parse(b.hold_expires_at) > Date.now());
  const cap = await getSlotCapacity(supabase, o.tenantId);
  if (blockConflict(vigentes, cap, o.start.getUTCHours() * 60 + o.start.getUTCMinutes(), o.end.getUTCHours() * 60 + o.end.getUTCMinutes())) return false;
  return !(await isSlotFull(supabase, o.barberId, o.tenantId, o.date, o.start, o.end));
}

// Segunda revision DESPUES de crear la cita: si dos personas reservaron el mismo horario casi a la vez, la que se creo ULTIMO pierde (empate: gana el id menor).
// Devuelve true si esta cita perdio (quien llama debe borrarla y devolver el abono).
export async function perdioCarrera(supabase: any, o: { appointmentId: string; createdAt: string; barberId: string; tenantId: string | null; date: string; start: Date; end: Date }): Promise<boolean> {
  const cap = await getSlotCapacity(supabase, o.tenantId);
  if (cap > 1) return exceededAfterInsert(supabase, o.barberId, o.tenantId, o.date, o.start, o.end);
  const { data } = await supabase.from("appointments").select("id, created_at").eq("barber_id", o.barberId).eq("date", o.date).in("status", ["scheduled", "confirmed", "in_progress"]).lt("start_time", o.end.toISOString()).gt("end_time", o.start.toISOString()).neq("id", o.appointmentId);
  const mio = new Date(o.createdAt).getTime();
  return (data || []).some((r: any) => { const t = new Date(r.created_at).getTime(); return t < mio || (t === mio && String(r.id) < o.appointmentId); });
}
