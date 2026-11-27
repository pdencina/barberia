// Resultados de cada promoción: reservas, atendidas, anuladas, ventas y qué servicios se tomaron con ella. Puro.
export interface ReservaPromo {
  id: string; cliente: string; telefono: string | null; correo: string | null; fecha: string; hora: string; profesional: string; servicios: string; estado: string; grupo: string | null;
}
export interface ResultadoPromo {
  detalle: ReservaPromo[];
  reservas: number; atendidas: number; anuladas: number; ventas: number; monto: number;
  servicios: Array<{ nombre: string; reservados: number; atendidos: number }>;
}
interface Cita {
  id: string; coupon_id: string; status: string; date?: string | null; start_time?: string | null; coupon_group?: string | null;
  client?: { name?: string | null; phone?: string | null; email?: string | null } | null; barber?: { name?: string | null } | null;
}
interface Linea { appointment_id: string; service_id: string; services?: { name?: string | null } | null }

export function resumirPromos(citas: Cita[], lineas: Linea[], ventas: Array<{ coupon_id: string; total: unknown }>, incluidos: Record<string, string[] | undefined> = {}) {
  const out: Record<string, ResultadoPromo> = {};
  const de = (id: string) => (out[id] ||= { reservas: 0, atendidas: 0, anuladas: 0, ventas: 0, monto: 0, servicios: [], detalle: [] });
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
  // Quién reservó (también las anuladas, marcadas como tales), por fecha y hora de la cita.
  for (const c of citas) {
    de(c.coupon_id).detalle.push({
      id: c.id, cliente: String(c.client?.name || "Sin nombre").trim(), telefono: c.client?.phone || null, correo: c.client?.email || null,
      fecha: String(c.date || ""), hora: String(c.start_time || "").slice(11, 16), profesional: String(c.barber?.name || "").trim(),
      servicios: lineas.filter((l) => l.appointment_id === c.id).map((l) => String(l.services?.name || "Servicio").trim()).join(" + "),
      estado: c.status, grupo: c.coupon_group || null,
    });
  }
  for (const e of Object.values(out)) e.detalle.sort((a, b) => `${a.fecha} ${a.hora}`.localeCompare(`${b.fecha} ${b.hora}`));
  for (const v of ventas) { const e = de(v.coupon_id); e.ventas++; e.monto += Number(v.total) || 0; }
  for (const e of Object.values(out)) e.servicios.sort((a, b) => b.reservados - a.reservados || a.nombre.localeCompare(b.nombre));
  return out;
}
