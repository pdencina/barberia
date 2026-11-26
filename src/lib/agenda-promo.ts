// Agenda de los profesionales durante una promoción: qué periodo mirar, recorte al horario de la promo y avisos. Puro.
import { aMinutos, type HorarioOc } from "@/lib/ocupacion";

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

export const SEMANAS_DEMANDA = 4;
export type Demanda = "alta" | "media" | "baja";
export interface ProAgenda {
  id: string; name: string;
  cortes: number;    // servicios cobrados en las últimas 4 semanas
  dias: number;      // días en que vendió en ese periodo
  reservas: number;  // reservas ya tomadas en los días (y horario) de la promoción
  atiende: boolean;  // tiene horario disponible en esos días
}

const promedio = (pros: ProAgenda[]) => { const con = pros.filter((p) => p.cortes > 0); return con.length ? con.reduce((s, p) => s + p.cortes, 0) / con.length : 0; };

/** Cuánto está cortando comparado con el resto del equipo. */
export function demandaDe(p: ProAgenda, pros: ProAgenda[]): Demanda {
  const m = promedio(pros);
  if (!m) return "media";
  return p.cortes >= m * 1.15 ? "alta" : p.cortes <= m * 0.85 ? "baja" : "media";
}

/** Avisos según a quién se marcó. Sin nadie marcado la promo vale con todos. */
export function avisosAgenda(pros: ProAgenda[], marcados: string[]): string[] {
  const out: string[] = [];
  const nombres = (l: ProAgenda[]) => l.map((p) => `${p.name} (${p.cortes})`).join(", ");
  const elegidos = marcados.length ? pros.filter((p) => marcados.includes(p.id)) : pros;
  const llenos = elegidos.filter((p) => demandaDe(p, pros) === "alta");
  if (llenos.length) out.push(`Incluidos que ya tienen mucha demanda: ${nombres(llenos)}.`);
  const sinHorario = marcados.length ? elegidos.filter((p) => !p.atiende) : [];
  if (sinHorario.length) out.push(`No tienen horario en esos días: ${sinHorario.map((p) => p.name).join(", ")}.`);
  if (marcados.length) {
    const fuera = pros.filter((p) => !marcados.includes(p.id) && p.atiende && demandaDe(p, pros) === "baja");
    if (fuera.length) out.push(`Quedaron fuera y están cortando menos que el resto: ${nombres(fuera)}.`);
  }
  return out;
}
