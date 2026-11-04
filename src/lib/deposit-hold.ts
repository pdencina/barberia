import { randomUUID } from "crypto";
import { blockConflict } from "@/lib/blocks";
import { getSlotCapacity, isSlotFull } from "@/lib/capacity";
import { isOnVacation } from "@/lib/vacations";
import { getWindowDays, isBeyondWindow } from "@/lib/booking-window";

// Mientras el cliente paga el abono, su horario queda bloqueado (la cita recien se crea cuando el pago se aprueba).
// El bloqueo vence solo: si no paga, el horario vuelve a estar libre.
export const HOLD_MINUTOS = 32; // un poco mas que los 30 min que Mercado Pago deja abierto el link de pago
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
export async function crearHold(supabase: any, o: { barberId: string; date: string; start: Date; end: Date }): Promise<string | null> {
  const ref = randomUUID();
  const { error } = await supabase.from("barber_blocks").insert({
    barber_id: o.barberId, date: o.date, all_day: false,
    start_time: hhmm(o.start.getUTCHours() * 60 + o.start.getUTCMinutes()), end_time: hhmm(o.end.getUTCHours() * 60 + o.end.getUTCMinutes()),
    reason: "Reserva en pago (abono)", hold_ref: ref, hold_expires_at: new Date(Date.now() + HOLD_MINUTOS * 60_000).toISOString(),
  });
  return error ? null : ref;
}

export async function liberarHold(supabase: any, ref: string | null | undefined): Promise<void> {
  if (!ref) return;
  try { await supabase.from("barber_blocks").delete().eq("hold_ref", ref); } catch { /* nada que liberar */ }
}
