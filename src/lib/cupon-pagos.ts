// Medios de pago permitidos por un cupón (coupons.conditions.pagos). Sin lista, se acepta cualquiera. Puro.
export const CODIGOS_PAGO = ["cash", "transfer", "debit_card", "credit_card"] as const;
const NOMBRES: Record<string, string> = { cash: "efectivo", transfer: "transferencia", debit_card: "débito", credit_card: "crédito" };
const DESDE_ETIQUETA: Record<string, string> = { Efectivo: "cash", Transferencia: "transfer", "Débito": "debit_card", "Crédito": "credit_card", "Crédito en cuotas": "credit_card" };

/** De las opciones marcadas en la promoción a los códigos del sistema. */
export const codigosDePago = (etiquetas: string[]) => Array.from(new Set(etiquetas.map((e) => DESDE_ETIQUETA[e]).filter(Boolean)));

export function limpiarPagos(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const l = Array.from(new Set(v.filter((x): x is string => (CODIGOS_PAGO as readonly string[]).includes(x as string))));
  return l.length === CODIGOS_PAGO.length ? [] : l;
}

/** Mensaje si alguno de los medios usados no está permitido; null si todo bien. */
export function pagoNoPermitido(permitidos: string[] | null | undefined, usados: string[]): string | null {
  if (!permitidos?.length || usados.every((u) => permitidos.includes(u))) return null;
  return `Con esta promoción solo se puede pagar con ${permitidos.map((p) => NOMBRES[p] || p).join(" o ")}.`;
}
