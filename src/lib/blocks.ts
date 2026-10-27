// Bloqueos del profesional (barber_blocks) frente a una hora que se quiere reservar. Misma regla que /api/public/availability:
// - un bloqueo de dia completo cierra todo el dia;
// - un bloqueo por horas cierra ese tramo;
// - excepcion (solo "cupos por bloque", capacidad > 1): un bloqueo con `spots` entre 1 y capacidad-1 solo quita esos cupos (lo resuelve capacity.ts).

export interface BlockRow { all_day?: boolean | null; start_time?: string | null; end_time?: string | null; spots?: number | null }

const toMin = (t: string): number | null => {
  const m = String(t).match(/(\d{2}):(\d{2})/);
  return m ? parseInt(m[1]) * 60 + parseInt(m[2]) : null;
};

/** "day" = el dia completo esta bloqueado; "time" = la hora pedida cae en un bloqueo; null = no hay conflicto. */
export function blockConflict(blocks: BlockRow[] | null | undefined, capacity: number, startMin: number, endMin: number): "day" | "time" | null {
  let timeConflict = false;
  for (const b of blocks || []) {
    if (b.all_day) return "day";
    if (!b.start_time || !b.end_time) continue;
    const s = toMin(b.start_time), e = toMin(b.end_time);
    if (s === null || e === null) continue;
    const spots = Number(b.spots);
    const partialCapacity = capacity > 1 && spots >= 1 && spots < capacity;
    if (partialCapacity) continue;
    if (e > startMin && s < endMin) timeConflict = true;
  }
  return timeConflict ? "time" : null;
}
