// Resultados de cada promoción: reservas, atendidas, anuladas, ventas y qué servicios se tomaron con ella. Puro.
export interface ResultadoPromo {
  reservas: number; atendidas: number; anuladas: number; ventas: number; monto: number;
  servicios: Array<{ nombre: string; reservados: number; atendidos: number }>;
}
interface Cita { id: string; coupon_id: string; status: string }
interface Linea { appointment_id: string; service_id: string; services?: { name?: string | null } | null }

export function resumirPromos(citas: Cita[], lineas: Linea[], ventas: Array<{ coupon_id: string; total: unknown }>, incluidos: Record<string, string[] | undefined> = {}) {
  const out: Record<string, ResultadoPromo> = {};
  const de = (id: string) => (out[id] ||= { reservas: 0, atendidas: 0, anuladas: 0, ventas: 0, monto: 0, servicios: [] });
  const porCita = new Map<string, Cita>();
  for (const c of citas) {
    const e = de(c.coupon_id);
    if (c.status === "cancelled") { e.anuladas++; continue; }
    porCita.set(c.id, c);
    e.reservas++;
    if (c.status === "completed") e.atendidas++;
  }
  for (const l of lineas) {
    const c = porCita.get(l.appointment_id);
    if (!c) continue;
    const solo = incluidos[c.coupon_id];
    if (solo?.length && !solo.includes(l.service_id)) continue; // un extra sin descuento no cuenta
    const nombre = String(l.services?.name || "Servicio").trim();
    const lista = de(c.coupon_id).servicios;
    let s = lista.find((x) => x.nombre === nombre);
    if (!s) lista.push((s = { nombre, reservados: 0, atendidos: 0 }));
    s.reservados++;
    if (c.status === "completed") s.atendidos++;
  }
  for (const v of ventas) { const e = de(v.coupon_id); e.ventas++; e.monto += Number(v.total) || 0; }
  for (const e of Object.values(out)) e.servicios.sort((a, b) => b.reservados - a.reservados || a.nombre.localeCompare(b.nombre));
  return out;
}
