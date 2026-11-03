// Productos (cosmeticos) que vende un profesional de ARRIENDO en el Punto de Venta. Pura: se prueba sin base de datos.
//
// Regla (modo «el negocio cobra el producto»): el producto es del negocio. Segun quien recibio la plata:
//   - la recibio el profesional (su maquina, su bolsillo, su cuenta) -> a fin de mes PAGA (precio - comision);
//   - la recibio el negocio (caja o su cuenta)                       -> el negocio le DEBE solo la comision.
// Quien recibe la plata se configura: debito/credito por negocio, efectivo y transferencia por profesional.
export type ModoProductosArriendo = "off" | "business_collects";
export interface ConfigNegocio { mode: ModoProductosArriendo; from: string | null; cardToBarber: boolean }
export interface ConfigProfesional { cashToBarber: boolean; transferToBarber: boolean; cashCounted: boolean } // cashCounted: su efectivo en caja ya se le descuenta del arriendo (ledger)
export interface Venta { id: string; createdAt: string; method: string; total: number; parts?: Array<{ method: string; amount: number }> }
export interface ItemVenta { txId: string; total: number; commission: number; isCosmetic: boolean }
export interface ResultadoProductos { owed: number; credit: number; cashHeldAdjust: number }

const fechaChile = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago" }).format(new Date(iso));

const alProfesional = (metodo: string, n: ConfigNegocio, p: ConfigProfesional): boolean =>
  metodo === "cash" ? p.cashToBarber : metodo === "transfer" ? p.transferToBarber : (metodo === "debit_card" || metodo === "credit_card") ? n.cardToBarber : false;

// Que parte (0 a 1) de la plata de la venta se la quedo el profesional, y que parte fue efectivo que quedo en caja y ya se le acredita por arriendo.
export function repartoDeLaVenta(v: Venta, n: ConfigNegocio, p: ConfigProfesional): { aPro: number; efectivoEnCajaContado: number } {
  const partes = v.method === "mixed" ? (v.parts || []) : [{ method: v.method, amount: v.total }];
  const suma = partes.reduce((s, x) => s + Math.max(0, Number(x.amount) || 0), 0);
  if (suma <= 0) return { aPro: 0, efectivoEnCajaContado: 0 };
  let aPro = 0, caja = 0;
  for (const x of partes) {
    const m = Math.max(0, Number(x.amount) || 0) / suma;
    if (alProfesional(x.method, n, p)) aPro += m;
    else if (x.method === "cash" && p.cashCounted) caja += m;
  }
  return { aPro, efectivoEnCajaContado: caja };
}

export function calcularProductosArriendo(items: ItemVenta[], ventas: Map<string, Venta>, n: ConfigNegocio, p: ConfigProfesional): ResultadoProductos {
  const vacio = { owed: 0, credit: 0, cashHeldAdjust: 0 };
  if (n.mode !== "business_collects") return vacio;
  let owed = 0, credit = 0, adjust = 0;
  for (const it of items) {
    if (!it.isCosmetic) continue; // solo cosmeticos
    const v = ventas.get(it.txId);
    if (!v) continue;
    if (n.from && fechaChile(v.createdAt) < n.from) continue;
    const P = Math.max(0, Number(it.total) || 0);
    const C = Math.min(P, Math.max(0, Number(it.commission) || 0));
    const r = repartoDeLaVenta(v, n, p);
    owed += (P - C) * r.aPro;
    credit += C * (1 - r.aPro);
    adjust += P * r.efectivoEnCajaContado; // ese efectivo ya estaba acreditado por el total: se reemplaza por la comision
  }
  return { owed: Math.round(owed), credit: Math.round(credit), cashHeldAdjust: Math.round(adjust) };
}
