// Ocupación de los profesionales: de las horas que están disponibles (su horario menos colaciones, bloqueos y vacaciones),
// cuántas tienen una cita completada. La diferencia es el «tiempo muerto». Puro: se prueba sin base de datos.
import { parseWallClock } from "@/lib/wallclock";

export type Modo = "comision" | "arriendo";
export interface ProOc { id: string; name: string; modo: Modo }
export interface HorarioOc { barber_id: string; day_of_week: number; is_working: boolean; start_time: string | null; end_time: string | null; break_start?: string | null; break_end?: string | null }
export interface DescansoOc { barber_id: string; day_of_week: number; start_time: string; end_time: string }
export interface BloqueoOc { barber_id: string; date: string; all_day?: boolean | null; start_time?: string | null; end_time?: string | null }
export interface VacacionOc { barber_id: string; start_date: string; end_date: string }
export interface CitaOc { barber_id: string; date: string; start_time: string; end_time: string }
export interface VentaOc { barber_id: string; dia: string; total: number }

export interface MesOc { disp: number; ocup: number; dias: number; ventas: number }   // minutos, minutos, días con agenda, pesos
export interface ResultadoOc {
  meses: string[];
  pros: { id: string; name: string; modo: Modo; porMes: Record<string, MesOc> }[];
  // Por mes y modalidad: minutos disponibles y ocupados en cada hora del día (0 a 23).
  horas: Record<string, Record<Modo, { disp: number[]; ocup: number[] }>>;
}

export const aMinutos = (t: string | null | undefined): number | null => {
  const m = String(t ?? "").match(/^(\d{1,2}):(\d{2})/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};
const dowDe = (fecha: string) => new Date(`${fecha}T00:00:00Z`).getUTCDay();
export function diasEntre(desde: string, hasta: string): string[] {
  const out: string[] = [];
  for (let d = new Date(`${desde}T00:00:00Z`); d <= new Date(`${hasta}T00:00:00Z`); d = new Date(d.getTime() + 86_400_000)) out.push(d.toISOString().slice(0, 10));
  return out;
}
export const pctOcup = (ocup: number, disp: number) => (disp > 0 ? Math.round((Math.min(ocup, disp) / disp) * 100) : 0);

// Verde desde 50%, ámbar desde 35%, rojo bajo eso.
export type NivelOc = "alto" | "medio" | "bajo";
export const nivelOcup = (pct: number): NivelOc => (pct >= 50 ? "alto" : pct >= 35 ? "medio" : "bajo");

const ceroHoras = () => ({ disp: new Array(24).fill(0), ocup: new Array(24).fill(0) });

export function calcularOcupacion(i: {
  pros: ProOc[]; horarios: HorarioOc[]; descansos: DescansoOc[]; bloqueos: BloqueoOc[]; vacaciones: VacacionOc[];
  citas: CitaOc[]; ventas: VentaOc[]; desde: string; hasta: string;
}): ResultadoOc {
  const dias = diasEntre(i.desde, i.hasta);
  const meses = Array.from(new Set(dias.map((d) => d.slice(0, 7))));
  const horas: ResultadoOc["horas"] = {};
  for (const m of meses) horas[m] = { comision: ceroHoras(), arriendo: ceroHoras() };

  const citasPor = new Map<string, CitaOc[]>();
  for (const c of i.citas) { const k = `${c.barber_id}|${c.date}`; (citasPor.get(k) || citasPor.set(k, []).get(k)!).push(c); }
  const bloqPor = new Map<string, BloqueoOc[]>();
  for (const b of i.bloqueos) { const k = `${b.barber_id}|${b.date}`; (bloqPor.get(k) || bloqPor.set(k, []).get(k)!).push(b); }

  const pros = i.pros.map((p) => {
    const porMes: Record<string, MesOc> = {};
    for (const m of meses) porMes[m] = { disp: 0, ocup: 0, dias: 0, ventas: 0 };
    const misHorarios = new Map(i.horarios.filter((h) => h.barber_id === p.id && h.is_working).map((h) => [h.day_of_week, h]));
    const misDescansos = i.descansos.filter((d) => d.barber_id === p.id);
    const misVac = i.vacaciones.filter((v) => v.barber_id === p.id);

    for (const dia of dias) {
      const h = misHorarios.get(dowDe(dia));
      if (!h) continue;
      if (misVac.some((v) => dia >= v.start_date && dia <= v.end_date)) continue;
      const bl = bloqPor.get(`${p.id}|${dia}`) || [];
      if (bl.some((b) => b.all_day)) continue;
      const ini = aMinutos(h.start_time), fin = aMinutos(h.end_time);
      if (ini === null || fin === null || fin <= ini) continue;

      const libre = new Array(1440).fill(false);
      for (let m = ini; m < Math.min(fin, 1440); m++) libre[m] = true;
      const quitar = (a: number | null, b: number | null) => { if (a === null || b === null) return; for (let m = Math.max(a, 0); m < Math.min(b, 1440); m++) libre[m] = false; };
      quitar(aMinutos(h.break_start), aMinutos(h.break_end));
      for (const d of misDescansos) if (d.day_of_week === dowDe(dia)) quitar(aMinutos(d.start_time), aMinutos(d.end_time));
      for (const b of bl) quitar(aMinutos(b.start_time), aMinutos(b.end_time));

      const ocupado = new Array(1440).fill(false);
      for (const c of citasPor.get(`${p.id}|${dia}`) || []) {
        const a = parseWallClock(c.start_time), z = parseWallClock(c.end_time);
        const mi = a.getUTCHours() * 60 + a.getUTCMinutes();
        const mf = mi + Math.max(0, Math.round((z.getTime() - a.getTime()) / 60000));
        for (let m = mi; m < Math.min(mf, 1440); m++) ocupado[m] = true;
      }
      let disp = 0, ocup = 0;
      const hh = horas[dia.slice(0, 7)][p.modo];
      for (let m = 0; m < 1440; m++) {
        if (!libre[m]) continue;
        disp++; hh.disp[Math.floor(m / 60)]++;
        if (ocupado[m]) { ocup++; hh.ocup[Math.floor(m / 60)]++; }
      }
      if (disp === 0) continue;
      const r = porMes[dia.slice(0, 7)];
      r.disp += disp; r.ocup += ocup; r.dias++;
    }
    for (const v of i.ventas) if (v.barber_id === p.id && porMes[v.dia.slice(0, 7)] && v.dia >= i.desde && v.dia <= i.hasta) porMes[v.dia.slice(0, 7)].ventas += Number(v.total) || 0;
    return { id: p.id, name: p.name, modo: p.modo, porMes };
  });
  return { meses, pros, horas };
}

// Totales de un grupo de profesionales en un mes.
export function totalGrupo(r: ResultadoOc, modo: Modo | "todos", mes: string): MesOc {
  const t: MesOc = { disp: 0, ocup: 0, dias: 0, ventas: 0 };
  for (const p of r.pros) { if (modo !== "todos" && p.modo !== modo) continue; const m = p.porMes[mes]; if (!m) continue; t.disp += m.disp; t.ocup += m.ocup; t.dias += m.dias; t.ventas += m.ventas; }
  return t;
}

export type Orden = "ocupacion" | "muerto" | "ventas" | "nombre";
export function ordenarPros<T extends { name: string; porMes: Record<string, MesOc> }>(pros: T[], mes: string, orden: Orden, asc: boolean): T[] {
  const v = (p: T): number => {
    const m = p.porMes[mes] || { disp: 0, ocup: 0, dias: 0, ventas: 0 };
    if (orden === "ocupacion") return pctOcup(m.ocup, m.disp);
    if (orden === "muerto") return Math.max(0, m.disp - m.ocup);
    return m.ventas;
  };
  const out = [...pros].sort((a, b) => (orden === "nombre" ? a.name.localeCompare(b.name, "es") : v(a) - v(b) || a.name.localeCompare(b.name, "es")));
  return asc ? out : out.reverse();
}

// ¿Las citas se están cerrando? Si muchas citas pasadas siguen «agendadas» o «confirmadas», es que no se marcan como completadas
// (ni se cobran en el Punto de Venta) y la ocupación saldría artificialmente baja. Cerrada = completada o «no llegó».
export const CIERRE_MINIMO = 70;   // % mínimo para confiar en los números
export interface CierreCitas { pct: number; cerradas: number; abiertas: number; confiable: boolean }
export function evaluarCierre(estados: string[]): CierreCitas {
  let cerradas = 0, abiertas = 0;
  for (const e of estados) {
    if (e === "completed" || e === "no_show") cerradas++;
    else if (e === "scheduled" || e === "confirmed" || e === "in_progress") abiertas++;
  }
  const total = cerradas + abiertas;
  const pct = total > 0 ? Math.round((cerradas / total) * 100) : 100;
  return { pct, cerradas, abiertas, confiable: total < 20 || pct >= CIERRE_MINIMO };
}
