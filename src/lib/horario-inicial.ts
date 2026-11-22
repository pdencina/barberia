// Horario de trabajo que se le propone a un profesional que todavia no tiene uno guardado. Antes siempre era lunes a sabado de 10:00 a 20:00,
// y al guardarlo (aunque solo quisiera agregar una colacion) quedaban esas horas aunque el negocio cerrara antes: los clientes veian horas
// que el dueño nunca programo. Ahora parte del HORARIO DEL NEGOCIO (Configuracion), si el negocio lo tiene cargado.
export interface FilaHorarioNegocio { day_of_week: number; is_closed: boolean | null; open_time: string | null; close_time: string | null }
export interface DiaHorarioInicial { day_of_week: number; is_working: boolean; start_time: string; end_time: string; break_start: null; break_end: null }

const hhmm = (t: string | null | undefined, fallback: string) => (t ? String(t).slice(0, 5) : fallback);

export function horarioInicial(barberId: string, negocio: FilaHorarioNegocio[] | null | undefined): (DiaHorarioInicial & { barber_id: string })[] {
  return Array.from({ length: 7 }, (_, i) => {
    const n = (negocio || []).find((x) => x.day_of_week === i);
    if (n) return { barber_id: barberId, day_of_week: i, is_working: !n.is_closed, start_time: hhmm(n.open_time, "10:00"), end_time: hhmm(n.close_time, "20:00"), break_start: null, break_end: null };
    return { barber_id: barberId, day_of_week: i, is_working: i !== 0, start_time: "10:00", end_time: "20:00", break_start: null, break_end: null };
  });
}
