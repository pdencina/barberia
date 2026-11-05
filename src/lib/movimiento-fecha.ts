// Cambiar la fecha de un movimiento (Ingresos/Egresos): se mueve el día y se conserva la hora que tenía.
// Puro: se prueba sin base de datos.
import { chileDayBoundsUtc, toChileDateStr } from "@/lib/utils";

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const ms = (iso: string) => { const [y, m, d] = iso.split("-").map(Number); return Date.UTC(y, m - 1, d); };

// Valida la fecha elegida: formato, que exista, no futura y no más de 5 años atrás. Devuelve null si está bien, o el mensaje.
export function errorFechaMovimiento(nueva: unknown, hoy: string): string | null {
  if (typeof nueva !== "string" || !FECHA.test(nueva)) return "Fecha no válida";
  const [y, m, d] = nueva.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  if (t.getUTCFullYear() !== y || t.getUTCMonth() !== m - 1 || t.getUTCDate() !== d) return "Fecha no válida";
  if (ms(nueva) > ms(hoy)) return "La fecha no puede ser futura";
  if (ms(nueva) < ms(hoy) - 5 * 366 * 86400000) return "La fecha es demasiado antigua";
  return null;
}

// Nuevo instante de creación: el día elegido (en hora de Chile) con la misma hora del día que tenía el movimiento.
export function moverFecha(createdIso: string, nuevaFecha: string): string {
  const original = toChileDateStr(createdIso);
  const desdeInicio = new Date(createdIso).getTime() - new Date(chileDayBoundsUtc(original).startUtc).getTime();
  const { startUtc, endUtc } = chileDayBoundsUtc(nuevaFecha);
  const nuevo = Math.min(new Date(startUtc).getTime() + desdeInicio, new Date(endUtc).getTime() - 1000);
  return new Date(nuevo).toISOString();
}
