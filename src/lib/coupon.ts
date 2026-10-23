// Tipos de cupon. Ademas de "porcentaje" y "monto fijo" hay cupones SIN MONTO: solo un codigo y un texto que vende
// ("CEJAS GRATIS - Muestra este cupon en recepcion y no pagas las cejas"). No necesitan cambios en la base de datos:
// se guardan como monto fijo con valor 0 (el enum discount_type solo tiene 'percentage' y 'fixed_amount').

export type CouponKind = "percentage" | "fixed_amount" | "none";

export function couponKind(c: { discount_type?: string | null; discount_value?: number | string | null } | null | undefined): CouponKind {
  const v = Number(c?.discount_value);
  if (!c || !Number.isFinite(v) || v <= 0) return "none";
  return c.discount_type === "percentage" ? "percentage" : "fixed_amount";
}

/** Como se guarda un cupon de cada tipo en la base. "none" = monto fijo de $0. */
export function couponToDb(kind: CouponKind, value: number | string): { discount_type: "percentage" | "fixed_amount"; discount_value: number } {
  if (kind === "none") return { discount_type: "fixed_amount", discount_value: 0 };
  const n = Number(value);
  return { discount_type: kind, discount_value: Number.isFinite(n) ? n : 0 };
}

/** Descuento en pesos que da un cupon sobre un monto. Un cupon sin monto no descuenta nada. */
export function computeCouponDiscount(c: { discount_type?: string | null; discount_value?: number | string | null }, amount: number): number {
  const kind = couponKind(c);
  if (kind === "none") return 0;
  const v = Number(c.discount_value);
  return kind === "percentage" ? Math.round((amount * v) / 100) : v;
}
