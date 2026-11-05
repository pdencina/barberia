// Precio interno (o especial) de un producto: lo que se descuenta al profesional en un «Descuento por planilla».
// Si el negocio no lo define, vale el precio de venta. Puro: se prueba sin base de datos.

export function precioInterno(p: { price?: number | string | null; internal_price?: number | string | null }): number {
  const interno = p.internal_price === null || p.internal_price === undefined || p.internal_price === "" ? NaN : Number(p.internal_price);
  if (Number.isFinite(interno) && interno >= 0) return Math.round(interno);
  return Math.round(Number(p.price) || 0);
}

// Valida lo que llega del formulario: vacío = sin precio interno (usa el de venta). Devuelve null (borrar), un número, o undefined (valor inválido).
export function normalizarPrecioInterno(v: unknown): number | null | undefined {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || n > 100_000_000) return undefined;
  return Math.round(n);
}
