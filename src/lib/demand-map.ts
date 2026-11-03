// Mapa de demanda: reservas promedio por semana en cada dia y hora. Puro: se prueba sin base de datos.
// Las citas guardan la hora de Chile escrita como UTC, por eso la hora se lee del texto, sin convertir zonas.
export interface DemandRow { date: string; start_time: string; status: string }
export interface DemandCell { dow: number; hour: number; total: number; avg: number }
export interface DemandMap {
  weeks: number; desde: string; hasta: string; totalReservas: number;
  cells: DemandCell[];                              // solo celdas con reservas
  porDia: { dow: number; total: number; avg: number }[]; // dow 1 = lunes ... 7 = domingo
  horas: number[];                                  // horas a mostrar (rango con actividad)
}
export const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const CUENTAN = new Set(["completed", "confirmed", "scheduled", "in_progress", "no_show"]); // todo menos canceladas

export function diaSemana(fecha: string): number { // 1 = lunes ... 7 = domingo
  const [y, m, d] = fecha.split("-").map(Number);
  const w = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return w === 0 ? 7 : w;
}
export function horaDe(startTime: string): number | null {
  const m = /[T ](\d{2}):\d{2}/.exec(startTime || "");
  return m ? Number(m[1]) : null;
}

export function construirMapa(rows: DemandRow[], weeks: number, desde: string, hasta: string): DemandMap {
  const tot = new Map<string, number>();
  const dia = new Map<number, number>();
  let total = 0;
  for (const r of rows) {
    if (!CUENTAN.has(r.status) || !r.date || r.date < desde || r.date > hasta) continue;
    const h = horaDe(r.start_time);
    if (h === null) continue;
    const dow = diaSemana(r.date);
    tot.set(`${dow}-${h}`, (tot.get(`${dow}-${h}`) || 0) + 1);
    dia.set(dow, (dia.get(dow) || 0) + 1);
    total++;
  }
  const cells: DemandCell[] = Array.from(tot.entries()).map(([k, n]) => { const [dow, hour] = k.split("-").map(Number); return { dow, hour, total: n, avg: n / weeks }; });
  // Horas a mostrar: de la primera a la ultima que tenga al menos 3 reservas en el periodo (descarta horas sueltas fuera de horario).
  const porHora = new Map<number, number>();
  for (const c of cells) porHora.set(c.hour, (porHora.get(c.hour) || 0) + c.total);
  const activas = Array.from(porHora.entries()).filter(([, n]) => n >= 3).map(([h]) => h);
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
  const mapaCelda = new Map(mapa.cells.map((c) => [`${c.dow}-${c.hour}`, c]));
  for (const d of mapa.porDia) {
    if (d.avg < 5) continue; // dia casi cerrado (ej. domingo)
    const horasDia = mapa.cells.filter((c) => c.dow === d.dow && c.total >= 3 && c.avg >= 1).map((c) => c.hour);
    if (!horasDia.length) continue;
    for (let h = Math.min(...horasDia); h <= Math.max(...horasDia); h++) {
      if (descanso.includes(h)) continue;
      out.push({ dow: d.dow, hour: h, avg: mapaCelda.get(`${d.dow}-${h}`)?.avg ?? 0 });
    }
  }
  return out.sort((a, b) => a.avg - b.avg || a.dow - b.dow || a.hour - b.hour).slice(0, max);
}
