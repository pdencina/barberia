// Reglas de un cupón (coupons.conditions, migración 182): fechas y horario de la ATENCIÓN y profesionales que lo aceptan.
import { limpiarPagos } from "@/lib/cupon-pagos";

export interface ReglasCupon {
  desde?: string; hasta?: string;          // YYYY-MM-DD (día de la cita)
  horaDesde?: string; horaHasta?: string;  // HH:MM (hora de inicio de la cita)
  profesionalIds?: string[];               // vacío = todos
  servicioIds?: string[];                  // servicios con descuento; vacío = todos
  pagos?: string[];                        // medios permitidos (cash, transfer…); vacío = cualquiera
  imagen?: string;                         // página de la promoción (imagen propia del negocio)
  titulo?: string;                         // página de la promoción
  personas?: number;                       // 2 = solo si reservan 2 personas juntas
  politicas?: string;                      // se aceptan antes de reservar en el link de la promoción
}

export interface CuponFila { active?: boolean | null; max_uses?: number | null; used_count?: number | null; valid_until?: string | null; conditions?: ReglasCupon | null }

/** Deja solo valores válidos (lo que llega del navegador no se guarda tal cual). Devuelve null si no hay ninguna regla. */
export function limpiarReglas(r: any): ReglasCupon | null {
  const f = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);
  const h = (v: unknown) => (typeof v === "string" && /^\d{2}:\d{2}$/.test(v) ? v : undefined);
  const ids = Array.isArray(r?.profesionalIds) ? r.profesionalIds.filter((x: unknown) => typeof x === "string" && /^[0-9a-f-]{36}$/i.test(x)).slice(0, 50) : [];
  const serv = Array.isArray(r?.servicioIds) ? r.servicioIds.filter((x: unknown) => typeof x === "string" && /^[0-9a-f-]{36}$/i.test(x)).slice(0, 300) : [];
  const pagos = limpiarPagos(r?.pagos);
  const personas = Number(r?.personas) === 2 ? 2 : undefined;
  const politicas = typeof r?.politicas === "string" && r.politicas.trim() ? r.politicas.trim().slice(0, 800) : undefined;
  const out: ReglasCupon = { personas, politicas, desde: f(r?.desde), hasta: f(r?.hasta), horaDesde: h(r?.horaDesde), horaHasta: h(r?.horaHasta), profesionalIds: ids.length ? ids : undefined, servicioIds: serv.length ? serv : undefined, pagos: pagos.length ? pagos : undefined,
    titulo: typeof r?.titulo === "string" && r.titulo.trim() ? r.titulo.trim().slice(0, 80) : undefined,
    imagen: typeof r?.imagen === "string" && /^https:\/\/[^\s"'<>]+$/.test(r.imagen) ? r.imagen : undefined };
  return Object.values(out).some(Boolean) ? JSON.parse(JSON.stringify(out)) : null;
}

const dia = (d: string) => d.split("-").reverse().join("/");

/** ¿Ya venció? Una fecha sola (guardada como medianoche UTC) vale hasta el final de ESE día en Chile; con hora, hasta esa hora. */
export function cuponVencido(validUntil: string | null | undefined, ahora: Date = new Date()): boolean {
  if (!validUntil) return false;
  const fin = new Date(validUntil);
  if (Number.isNaN(fin.getTime())) return false;
  if (fin.getUTCHours() === 0 && fin.getUTCMinutes() === 0 && fin.getUTCSeconds() === 0) {
    const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago" }).format(ahora);
    return hoy > fin.toISOString().slice(0, 10);
  }
  return ahora > fin;
}

/** Por qué NO se puede usar el cupón en esa cita, o null si se puede. `fecha` YYYY-MM-DD y `hora` HH:MM de la cita (hora de Chile). */
export function motivoCuponNoValido(c: CuponFila, cita: { barberId: string; fecha: string; hora: string; serviceIds?: string[] }, ahora: Date = new Date()): string | null {
  if (c.active === false) return "Ese código ya no está activo.";
  if (c.max_uses && (c.used_count || 0) >= c.max_uses) return "Ese código ya se agotó.";
  if (cuponVencido(c.valid_until, ahora)) return "Ese código ya venció.";
  const r = c.conditions || {};
  if (r.desde && cita.fecha < r.desde) return `Ese código vale para atenciones desde el ${dia(r.desde)}.`;
  if (r.hasta && cita.fecha > r.hasta) return `Ese código vale para atenciones hasta el ${dia(r.hasta)}.`;
  if (r.horaDesde && cita.hora < r.horaDesde) return `Ese código vale desde las ${r.horaDesde} hrs.`;
  if (r.horaHasta && cita.hora > r.horaHasta) return `Ese código vale hasta las ${r.horaHasta} hrs.`;
  if (r.profesionalIds?.length && !r.profesionalIds.includes(cita.barberId)) return "Ese código no vale con este profesional.";
  // Con al menos un servicio de la promoción sirve (el descuento se calcula solo sobre esos).
  if (r.servicioIds?.length && cita.serviceIds && !cita.serviceIds.some((id) => r.servicioIds!.includes(id))) return "Ese código no vale para ese servicio.";
  return null;
}

/** Parte de la cuenta que puede tener descuento: la suma de los servicios de la promoción (sin lista, todo el total). */
export function baseConDescuento(r: ReglasCupon | null | undefined, servicios: Array<{ id: string; price: number }>, total: number): number {
  if (!r?.servicioIds?.length) return total;
  const suma = servicios.filter((s) => r.servicioIds!.includes(s.id)).reduce((n, s) => n + (Number(s.price) || 0), 0);
  return Math.max(0, Math.min(total, suma));
}

/** "2026-12-01T15:30..." (hora de Chile escrita como UTC) -> "15:30". */
export const horaDeCita = (startTime: string) => String(startTime || "").slice(11, 16);
