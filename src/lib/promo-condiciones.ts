// Condiciones de una promoción (campañas de Retención): se arman como texto y van en el WhatsApp y en el correo.
// Todo es opcional; sin nada elegido no se agrega ninguna línea.

export const MEDIOS_DE_PAGO = ["Efectivo", "Débito", "Crédito", "Crédito en cuotas", "Transferencia"] as const;

export type FormaCanje = "" | "recepcion" | "online";

export interface CondicionesPromo {
  desde: string; hasta: string;           // YYYY-MM-DD
  horaDesde: string; horaHasta: string;   // HH:MM
  pagos: string[];                        // vacío = no se menciona
  todosLosPagos: boolean;
  profesionales: string[];                // nombres; vacío = no se menciona
  profesionalIds?: string[];              // los mismos, para las reglas del cupón
  canje: FormaCanje;
}

export const SIN_CONDICIONES: CondicionesPromo = { desde: "", hasta: "", horaDesde: "", horaHasta: "", pagos: [], todosLosPagos: false, profesionales: [], canje: "" };

const fecha = (d: string) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d); return m ? `${m[3]}/${m[2]}/${m[1]}` : ""; };
const lista = (a: string[]) => (a.length < 2 ? a.join("") : `${a.slice(0, -1).join(", ")} y ${a[a.length - 1]}`);

/** Problema a corregir antes de enviar, o null. */
export function errorCondiciones(c: CondicionesPromo): string | null {
  if (c.desde && c.hasta && c.hasta < c.desde) return "La fecha «hasta» es anterior a la fecha «desde».";
  if (c.horaDesde && c.horaHasta && c.horaHasta <= c.horaDesde) return "La hora «hasta» debe ser posterior a la hora «desde».";
  return null;
}

/** Texto de las condiciones ("" si no hay ninguna). `hayCupon` ajusta las instrucciones de canje. */
export function textoCondiciones(c: CondicionesPromo, hayCupon = false): string {
  const l: string[] = [];
  const d = fecha(c.desde), h = fecha(c.hasta);
  if (d && h) l.push(d === h ? `Válida solo el ${d}` : `Válida del ${d} al ${h}`);
  else if (d) l.push(`Válida desde el ${d}`);
  else if (h) l.push(`Válida hasta el ${h}`);
  if (c.horaDesde && c.horaHasta) l.push(`Horario: de ${c.horaDesde} a ${c.horaHasta} hrs`);
  else if (c.horaDesde) l.push(`Horario: desde las ${c.horaDesde} hrs`);
  else if (c.horaHasta) l.push(`Horario: hasta las ${c.horaHasta} hrs`);
  if (c.todosLosPagos) l.push("Válida con todos los medios de pago");
  else if (c.pagos.length) l.push(`Pago solo con: ${lista(c.pagos.map((p) => p.toLowerCase()))}`);
  if (c.profesionales.length) l.push(`Válida solo con: ${lista(c.profesionales)}`);
  if (c.canje === "recepcion") l.push(hayCupon ? "Muestra el código en recepción" : "Menciona esta promoción en recepción");
  if (c.canje === "online") l.push(hayCupon ? "Para pago online, usa el código" : "Disponible con pago online");
  return l.length ? `Condiciones:\n${l.map((x) => `• ${x}`).join("\n")}` : "";
}
