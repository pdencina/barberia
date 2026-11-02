// Regla de productos para el profesional (decision de Nico, 2 nov. 2026):
//   - Los productos (consumibles, bebidas, aseo, generales, etc.) JAMAS le dan plata al profesional.
//   - Solo los COSMETICOS tienen una comision de venta: $2.000 por unidad vendida.
//   - En ningun caso un producto suma a la base de la comision por servicios (eso ya era asi en el libro).
// Una comision propia del producto (inventario > comision por venta) solo se respeta si el producto es cosmetico; si no tiene, vale el valor fijo.
export const COSMETIC_COMMISSION_PER_UNIT = 2000;

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
export const isCosmeticCategory = (category: string | null | undefined): boolean => !!category && /^cosmetic/.test(norm(category));

export interface ProductRule { category?: string | null; type?: string | null; value?: number | null }

// Comision (en pesos) que gana el profesional por una linea de venta de un producto.
export function productCommission(p: ProductRule | undefined, quantity: number, total: number): number {
  if (!p || !isCosmeticCategory(p.category)) return 0;
  const qty = Number(quantity) > 0 ? Number(quantity) : 1;
  const v = Number(p.value) || 0;
  if (p.type === "percent" && v > 0) return Math.round((Number(total) * v) / 100);
  if (p.type === "fixed" && v > 0) return Math.round(qty * v);
  return qty * COSMETIC_COMMISSION_PER_UNIT;
}
