// Link de promoción (re-booking.cl/<negocio>/promocion): qué días y horas se ofrecen y cómo se describen. Puro.
import type { ReglasCupon } from "@/lib/cupon-reglas";
import { nombresCortos } from "@/lib/promo-condiciones";

const MAX_DIAS = 21;

/** Días en que se puede reservar con la promoción, desde hoy. */
export function diasDePromo(hoy: string, r: ReglasCupon, validUntil: string | null | undefined, sumar: (f: string, n: number) => string): string[] {
  const desde = r.desde && r.desde > hoy ? r.desde : hoy;
  // Sin fecha de término en las reglas, manda el vencimiento del cupón; sin ninguno, dos semanas.
  const venceChile = validUntil ? new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago" }).format(new Date(validUntil)) : null;
  const hasta = r.hasta || venceChile || sumar(desde, 13);
  const out: string[] = [];
  for (let d = desde; d <= hasta && out.length < MAX_DIAS; d = sumar(d, 1)) out.push(d);
  return out;
}

/** Solo las horas que caben en el horario de la promoción. `slot` = "YYYY-MM-DDTHH:mm:ss" (hora de Chile). */
export function horasDePromo(slots: string[], horaDesde: string | null, horaHasta: string | null): string[] {
  return slots.filter((s) => { const h = s.slice(11, 16); return (!horaDesde || h >= horaDesde) && (!horaHasta || h <= horaHasta); });
}

const dia = (d: string) => d.split("-").reverse().join("/");
const PAGOS: Record<string, string> = { cash: "efectivo", transfer: "transferencia", debit_card: "débito", credit_card: "crédito" };
const unir = (a: string[]) => (a.length < 2 ? a.join("") : `${a.slice(0, -1).join(", ")} y ${a[a.length - 1]}`);

export function detallesPromo(r: ReglasCupon, profesionales: string[]): Array<{ etiqueta: string; valor: string }> {
  const l: Array<{ etiqueta: string; valor: string }> = [];
  if (r.desde && r.hasta) l.push({ etiqueta: "Fechas", valor: `del ${dia(r.desde)} al ${dia(r.hasta)}` });
  else if (r.hasta) l.push({ etiqueta: "Válida", valor: `hasta el ${dia(r.hasta)}` });
  else if (r.desde) l.push({ etiqueta: "Válida", valor: `desde el ${dia(r.desde)}` });
  if (r.horaDesde || r.horaHasta) l.push({ etiqueta: "Horario", valor: r.horaDesde && r.horaHasta ? `de ${r.horaDesde} a ${r.horaHasta} hrs` : r.horaDesde ? `desde las ${r.horaDesde} hrs` : `hasta las ${r.horaHasta} hrs` });
  if (r.pagos?.length) l.push({ etiqueta: "Pago solo con", valor: unir(r.pagos.map((p) => PAGOS[p] || p)) });
  if (r.profesionalIds?.length && profesionales.length) l.push({ etiqueta: "Con", valor: unir(nombresCortos(profesionales)) });
  if (r.servicioIds?.length) l.push({ etiqueta: "Servicios", valor: "solo los incluidos en la promoción" });
  if (r.personas === 2) l.push({ etiqueta: "Reserva", valor: "solo 2 personas juntas, el mismo día" });
  return l;
}
