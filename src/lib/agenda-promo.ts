// Agenda de los profesionales durante una promoción: qué periodo mirar, recorte al horario de la promo y avisos. Puro.
import { aMinutos, type HorarioOc } from "@/lib/ocupacion";

export const MUCHA_AGENDA = 70; // % ocupado desde el que se avisa «ya tiene mucha agenda»
export const CON_ESPACIO = 35;  // % ocupado bajo el que se avisa «tiene espacio»
const MAX_DIAS = 62;
const esFecha = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

/** Periodo a revisar: desde hoy (lo pasado ya no sirve). Sin fechas, los próximos 7 días. */
export function periodoPromo(desde: unknown, hasta: unknown, hoy: string, sumar: (f: string, n: number) => string):
  { desde: string; hasta: string; porDefecto: boolean } | { error: string } {
  const d = esFecha(desde) && desde > hoy ? desde : hoy;
  const h = esFecha(hasta) ? hasta : sumar(d, 6);
  if (h < d) return { error: "Las fechas de la promoción ya pasaron o están al revés." };
  const tope = sumar(d, MAX_DIAS - 1);
  return { desde: d, hasta: h > tope ? tope : h, porDefecto: !esFecha(hasta) };
}

/** El horario de cada profesional, recortado a las horas de la promoción. */
export function recortarHorarios(horarios: HorarioOc[], horaDesde: unknown, horaHasta: unknown): HorarioOc[] {
  const a = aMinutos(typeof horaDesde === "string" ? horaDesde : null);
  const b = aMinutos(typeof horaHasta === "string" ? horaHasta : null);
  if (a === null && b === null) return horarios;
  const t = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  return horarios.map((h) => {
    const ini = aMinutos(h.start_time), fin = aMinutos(h.end_time);
    if (ini === null || fin === null) return h;
    const i = Math.max(ini, a ?? ini), f = Math.min(fin, b ?? fin);
    return f > i ? { ...h, start_time: t(i), end_time: t(f) } : { ...h, is_working: false };
  });
}

export interface ProAgenda { id: string; name: string; disp: number; ocup: number; pct: number }

/** Avisos según a quién se marcó. Sin nadie marcado la promo vale con todos. */
export function avisosAgenda(pros: ProAgenda[], marcados: string[]): string[] {
  const out: string[] = [];
  const nombres = (l: ProAgenda[]) => l.map((p) => `${p.name} (${p.pct}%)`).join(", ");
  const elegidos = marcados.length ? pros.filter((p) => marcados.includes(p.id)) : pros;
  const llenos = elegidos.filter((p) => p.disp > 0 && p.pct >= MUCHA_AGENDA);
  if (llenos.length) out.push(`Ya tienen mucha agenda: ${nombres(llenos)}.`);
  const sinHoras = marcados.length ? elegidos.filter((p) => p.disp === 0) : [];
  if (sinHoras.length) out.push(`No tienen horas disponibles en esos días: ${sinHoras.map((p) => p.name).join(", ")}.`);
  if (marcados.length) {
    const fuera = pros.filter((p) => !marcados.includes(p.id) && p.disp > 0 && p.pct <= CON_ESPACIO);
    if (fuera.length) out.push(`Quedaron fuera y tienen bastante espacio: ${nombres(fuera)}.`);
  }
  return out;
}
