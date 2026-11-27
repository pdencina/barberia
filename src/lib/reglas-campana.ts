import { codigosDePago } from "@/lib/cupon-pagos";
import type { CondicionesPromo } from "@/lib/promo-condiciones";

/** Reglas del código después de enviar una campaña: se suma lo que la campaña trae puesto a lo que ya tenía. null = nada que guardar. */
export function reglasDeCampana(previas: any, c: CondicionesPromo, imagen: string, titulo: string): Record<string, any> | null {
  const nuevas: Record<string, any> = { desde: c.desde, hasta: c.hasta, horaDesde: c.horaDesde, horaHasta: c.horaHasta, profesionalIds: c.profesionalIds || [], pagos: codigosDePago(c.pagos), imagen, titulo: titulo.trim() };
  const puestas = Object.entries(nuevas).filter(([, v]) => (Array.isArray(v) ? v.length : v));
  if (!puestas.length && !c.todosLosPagos) return null;
  return { ...(previas || {}), ...Object.fromEntries(puestas), ...(c.todosLosPagos ? { pagos: [] } : {}) };
}
