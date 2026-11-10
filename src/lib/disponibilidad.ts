// Horas que el equipo de un negocio está disponible en cada día de la semana y hora del día, según SUS horarios reales
// (horario de cada profesional, menos colaciones, descansos, bloqueos y vacaciones). Puro: se prueba sin base de datos.
// Cada negocio tiene los suyos (ej. de 10 a 20 de lunes a viernes y sábado de 9 a 17), así el mapa de demanda no muestra horas en que no se atiende.
import { aMinutos, diasEntre, type HorarioOc, type DescansoOc, type BloqueoOc, type VacacionOc } from "@/lib/ocupacion";

// Clave «dow-hora» (dow 1 = lunes ... 7 = domingo, como el mapa de demanda) -> horas disponibles sumadas en el período (todos los profesionales).
export function disponibilidadPorDiaHora(i: { proIds: string[]; horarios: HorarioOc[]; descansos: DescansoOc[]; bloqueos: BloqueoOc[]; vacaciones: VacacionOc[]; desde: string; hasta: string }): Record<string, number> {
  const minutos: Record<string, number> = {}; // se suman minutos enteros y al final se pasa a horas (sin errores de decimales)
  const dias = diasEntre(i.desde, i.hasta);
  for (const id of i.proIds) {
    const hor = new Map(i.horarios.filter((h) => h.barber_id === id && h.is_working).map((h) => [h.day_of_week, h])); // day_of_week: 0 = domingo
    const des = i.descansos.filter((d) => d.barber_id === id);
    const vac = i.vacaciones.filter((v) => v.barber_id === id);
    const blo = i.bloqueos.filter((b) => b.barber_id === id);
    for (const dia of dias) {
      const js = new Date(`${dia}T00:00:00Z`).getUTCDay();
      const h = hor.get(js);
      if (!h) continue;
      if (vac.some((v) => dia >= v.start_date && dia <= v.end_date)) continue;
      const delDia = blo.filter((b) => b.date === dia);
      if (delDia.some((b) => b.all_day)) continue;
      const ini = aMinutos(h.start_time), fin = aMinutos(h.end_time);
      if (ini === null || fin === null || fin <= ini) continue;
      const libre = new Array(1440).fill(false);
      for (let m = ini; m < Math.min(fin, 1440); m++) libre[m] = true;
      const quitar = (a: number | null, b: number | null) => { if (a === null || b === null) return; for (let m = Math.max(a, 0); m < Math.min(b, 1440); m++) libre[m] = false; };
      quitar(aMinutos(h.break_start), aMinutos(h.break_end));
      for (const d of des) if (d.day_of_week === js) quitar(aMinutos(d.start_time), aMinutos(d.end_time));
      for (const b of delDia) quitar(aMinutos(b.start_time), aMinutos(b.end_time));
      const dow = js === 0 ? 7 : js;
      for (let m = 0; m < 1440; m++) if (libre[m]) { const k = `${dow}-${Math.floor(m / 60)}`; minutos[k] = (minutos[k] || 0) + 1; }
    }
  }
  const out: Record<string, number> = {};
  for (const k of Object.keys(minutos)) out[k] = minutos[k] / 60;
  return out;
}
