// Plazo para que el cliente cancele o modifique su cita desde el correo (tenants.client_change_hours, migración 144).
import { parseWallClock } from "@/lib/wallclock";

export const PLAZOS_RAPIDOS = [1, 3, 6, 12, 24, 48];
export const PLAZO_PREDETERMINADO = 2;   // lo que regía antes de poder elegirlo
export const PLAZO_MAXIMO = 720;         // 30 días

// Acepta solo enteros de 0 a 720; cualquier otra cosa devuelve null.
export function plazoValido(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 && n <= PLAZO_MAXIMO ? n : null;
}

// «1 hora», «3 horas», «2 días», «1 día y 12 horas».
export function textoPlazo(h: number): string {
  if (h === 0) return "el último minuto";
  if (h < 24) return `${h} ${h === 1 ? "hora" : "horas"}`;
  const d = Math.floor(h / 24), r = h % 24;
  const dias = `${d} ${d === 1 ? "día" : "días"}`;
  return r === 0 ? dias : `${dias} y ${r} ${r === 1 ? "hora" : "horas"}`;
}

// Frase para el correo.
export const fraseCorreoPlazo = (h: number) => `Puedes cancelar o modificar tu cita hasta ${textoPlazo(h)} antes de la hora.`;

// Horas que faltan para la cita. La cita se guarda como hora de Chile escrita como UTC (parseWallClock); «ahora» debe venir
// ya en hora de pared (aHoraPared de cancel-reasons).
export function horasHasta(inicioCita: string | Date, ahoraPared: Date): number {
  const inicio = typeof inicioCita === "string" ? parseWallClock(inicioCita) : inicioCita;
  return (inicio.getTime() - ahoraPared.getTime()) / 3_600_000;
}
export const aunSePuedeCambiar = (inicioCita: string | Date, ahoraPared: Date, plazoHoras: number) => horasHasta(inicioCita, ahoraPared) >= plazoHoras;

// Plazo del negocio; sin la migración (o con un valor raro) queda el de siempre.
export async function getPlazoCambios(supabase: any, tenantId: string | null | undefined): Promise<number> {
  if (!tenantId) return PLAZO_PREDETERMINADO;
  const { data, error } = await supabase.from("tenants").select("client_change_hours").eq("id", tenantId).maybeSingle();
  if (error) return PLAZO_PREDETERMINADO;
  return plazoValido((data as any)?.client_change_hours) ?? PLAZO_PREDETERMINADO;
}
