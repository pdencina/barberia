// Mapa de demanda: reservas promedio por semana en cada dia y hora. Puro: se prueba sin base de datos.
// Las citas guardan la hora de Chile escrita como UTC, por eso la hora se lee del texto, sin convertir zonas.
//
// Se mide el TIEMPO OCUPADO, no solo cuántas citas empiezan en cada hora: una cita larga (por ejemplo 3 horas) ocupa a su profesional
// en todas las horas que dura. Antes solo contaba la hora de inicio, y para un negocio de servicios largos las horas siguientes
// (10 y 11 si empieza a las 9) salían como «poca demanda» cuando en realidad estaban ocupadas. El tiempo ocupado se expresa en
// «reservas equivalentes» (dividido por la duración típica de las citas del negocio) para que los números sigan siendo comparables.
export interface DemandRow { date: string; start_time: string; status: string; end_time?: string | null }
export interface DemandCell { dow: number; hour: number; total: number; avg: number }
export interface DemandMap {
  weeks: number; desde: string; hasta: string; totalReservas: number;
  cells: DemandCell[];                              // solo celdas con reservas
  porDia: { dow: number; total: number; avg: number }[]; // dow 1 = lunes ... 7 = domingo
  horas: number[];                                  // horas a mostrar (rango con actividad)
}
export const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const CUENTAN = new Set(["completed", "confirmed", "scheduled", "in_progress", "no_show"]); // todo menos canceladas

// Los umbrales (día "casi cerrado", hora o celda "con actividad") se pensaron para un negocio grande (~60 reservas por semana o más).
// En uno chico (ej. 1 profesional con 9 reservas por semana) todo quedaba bajo el umbral: todos los días salían "cerrados" y todo en 0.
// Por eso los umbrales se achican en proporción al volumen del negocio (nunca se agrandan): negocio de 60+/semana = igual que antes.
export function escalaNegocio(totalReservas: number, weeks: number): number {
  const porSemana = weeks > 0 ? totalReservas / weeks : 0;
  return Math.min(1, Math.max(0.05, porSemana / 60));
}
export const esDiaCerrado = (avg: number, escala: number) => avg < Math.max(0.25, 5 * escala);

export function diaSemana(fecha: string): number { // 1 = lunes ... 7 = domingo
  const [y, m, d] = fecha.split("-").map(Number);
  const w = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return w === 0 ? 7 : w;
}
export function horaDe(startTime: string): number | null {
  const m = /[T ](\d{2}):\d{2}/.exec(startTime || "");
  return m ? Number(m[1]) : null;
}
const minutoDe = (t: string | null | undefined): number | null => {
  const m = /[T ](\d{2}):(\d{2})/.exec(t || "");
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};
// Minutos de la cita que caen en cada hora del día. Sin hora de término válida se asume 1 hora (como antes, solo cuenta la hora de inicio).
export function minutosPorHora(startTime: string, endTime?: string | null): Map<number, number> {
  const ini = minutoDe(startTime);
  const out = new Map<number, number>();
  if (ini === null) return out;
  let fin = minutoDe(endTime);
  if (fin === null || fin <= ini || fin - ini > 12 * 60) fin = ini + 60;
  fin = Math.min(fin, 24 * 60);
  for (let h = Math.floor(ini / 60); h * 60 < fin; h++) {
    const m = Math.min(fin, (h + 1) * 60) - Math.max(ini, h * 60);
    if (m > 0) out.set(h, m);
  }
  return out;
}

export function construirMapa(rows: DemandRow[], weeks: number, desde: string, hasta: string): DemandMap {
  const ocupado = new Map<string, number>();            // «dow-hora» -> horas de agenda ocupadas en el período
  const diaOcupado = new Map<number, number>();
  let total = 0, minutosTotales = 0;
  for (const r of rows) {
    if (!CUENTAN.has(r.status) || !r.date || r.date < desde || r.date > hasta) continue;
    const reparto = minutosPorHora(r.start_time, r.end_time);
    if (reparto.size === 0) continue;
    const dow = diaSemana(r.date);
    for (const [h, min] of Array.from(reparto.entries())) {
      ocupado.set(`${dow}-${h}`, (ocupado.get(`${dow}-${h}`) || 0) + min / 60);
      diaOcupado.set(dow, (diaOcupado.get(dow) || 0) + min / 60);
      minutosTotales += min;
    }
    total++;
  }
  // Duración típica de una cita del negocio (en horas): convierte horas ocupadas en «reservas equivalentes».
  const duracionTipica = total > 0 ? Math.max(0.25, minutosTotales / 60 / total) : 1;
  const tot = new Map<string, number>(Array.from(ocupado.entries()).map(([k, v]) => [k, v / duracionTipica]));
  const dia = new Map<number, number>(Array.from(diaOcupado.entries()).map(([k, v]) => [k, v / duracionTipica]));
  const cells: DemandCell[] = Array.from(tot.entries()).map(([k, n]) => { const [dow, hour] = k.split("-").map(Number); return { dow, hour, total: n, avg: n / weeks }; });
  // Horas a mostrar: de la primera a la ultima que tenga al menos 3 reservas en el periodo (descarta horas sueltas fuera de horario).
  const porHora = new Map<number, number>();
  for (const c of cells) porHora.set(c.hour, (porHora.get(c.hour) || 0) + c.total);
  const escala = escalaNegocio(total, weeks);
  const activas = Array.from(porHora.entries()).filter(([, n]) => n >= 3 && n / weeks >= 2 * escala).map(([h]) => h); // al menos 2 reservas por semana en total (menos en un negocio chico)
  const horas: number[] = [];
  if (activas.length) for (let h = Math.min(...activas); h <= Math.max(...activas); h++) horas.push(h);
  const porDia = [1, 2, 3, 4, 5, 6, 7].map((dow) => ({ dow, total: dia.get(dow) || 0, avg: (dia.get(dow) || 0) / weeks }));
  return { weeks, desde, hasta, totalReservas: total, cells, porDia, horas };
}

export interface HorarioFlojo { dow: number; hour: number; avg: number }
// Los horarios mas flojos: solo dentro del rango de horas del dia (primera a ultima hora con al menos 1 reserva por semana ese dia; asi las horas de cierre no cuentan como flojas), sin dias casi cerrados
// y sin las horas marcadas como descanso. Ordenados de menos a mas reservas.
export function horariosFlojos(mapa: DemandMap, descanso: number[] = [], max = 8): HorarioFlojo[] {
  const out: HorarioFlojo[] = [];
  const escala = escalaNegocio(mapa.totalReservas, mapa.weeks);
  const mapaCelda = new Map(mapa.cells.map((c) => [`${c.dow}-${c.hour}`, c]));
  for (const d of mapa.porDia) {
    if (esDiaCerrado(d.avg, escala)) continue; // dia casi cerrado (ej. domingo)
    const horasDia = mapa.cells.filter((c) => c.dow === d.dow && c.total >= 3 && c.avg >= escala).map((c) => c.hour);
    if (!horasDia.length) continue;
    for (let h = Math.min(...horasDia); h <= Math.max(...horasDia); h++) {
      if (descanso.includes(h)) continue;
      out.push({ dow: d.dow, hour: h, avg: mapaCelda.get(`${d.dow}-${h}`)?.avg ?? 0 });
    }
  }
  return out.sort((a, b) => a.avg - b.avg || a.dow - b.dow || a.hour - b.hour).slice(0, max);
}

export type Nivel = "fuerte" | "normal" | "flojo";
// Dias: frente al promedio de los dias en que se atiende (los casi cerrados no cuentan).
export function nivelesPorDia(mapa: DemandMap): Map<number, { avg: number; nivel: Nivel | "cerrado" }> {
  const escala = escalaNegocio(mapa.totalReservas, mapa.weeks);
  const abiertos = mapa.porDia.filter((d) => !esDiaCerrado(d.avg, escala));
  const media = abiertos.length ? abiertos.reduce((t, d) => t + d.avg, 0) / abiertos.length : 0;
  return new Map(mapa.porDia.map((d) => [d.dow, { avg: d.avg, nivel: esDiaCerrado(d.avg, escala) ? "cerrado" : d.avg < media * 0.75 ? "flojo" : d.avg > media * 1.2 ? "fuerte" : "normal" }]));
}
// Horas: promedio de reservas por semana en esa hora, sumando los dias en que se atiende.
export function nivelesPorHora(mapa: DemandMap): { hour: number; avg: number; nivel: Nivel }[] {
  const escala = escalaNegocio(mapa.totalReservas, mapa.weeks);
  const abiertos = new Set(mapa.porDia.filter((d) => !esDiaCerrado(d.avg, escala)).map((d) => d.dow));
  const base = mapa.horas.map((hour) => ({ hour, avg: mapa.cells.filter((c) => c.hour === hour && abiertos.has(c.dow)).reduce((t, c) => t + c.avg, 0) / Math.max(1, abiertos.size) }));
  const media = base.length ? base.reduce((t, b) => t + b.avg, 0) / base.length : 0;
  return base.map((b) => ({ ...b, nivel: b.avg < media * 0.6 ? "flojo" : b.avg > media * 1.3 ? "fuerte" : "normal" }));
}
// Una celda (dia + hora) frente a la mas fuerte del mapa.
export function nivelCelda(avg: number, maxAvg: number): Nivel { const r = maxAvg > 0 ? avg / maxAvg : 0; return r >= 0.6 ? "fuerte" : r <= 0.3 ? "flojo" : "normal"; }
