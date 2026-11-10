import type { createAdminSupabase } from "@/lib/supabase/server";

// Tramos de precio mayorista (respuesta de Felipe, 10 nov. 2026). Cada tramo = descuento sobre el precio de lista.
// El rango de compras solo SUGIERE el tramo; el tramo real lo asigna el administrador a cada cliente.

type Admin = ReturnType<typeof createAdminSupabase>;

export type PriceTier = { id: string; name: string; discountPct: number; minAmount: number | null; maxAmount: number | null; sort: number; active: boolean };

// Lo que contó Felipe. Se ofrecen como punto de partida en Configuración; nada se guarda hasta que el administrador lo confirma.
// OJO: entre 5 y 6 MM y sobre 10 MM no hay tramo definido: se pregunta a Felipe.
export const FELIPE_TIERS: Omit<PriceTier, "id" | "active">[] = [
  { name: "Venta público", discountPct: 0, minAmount: null, maxAmount: null, sort: 0 },
  { name: "Mayorista 1", discountPct: 5, minAmount: 1_000_000, maxAmount: 2_000_000, sort: 1 },
  { name: "Mayorista 2", discountPct: 7, minAmount: 2_000_000, maxAmount: 3_000_000, sort: 2 },
  { name: "Mayorista 3", discountPct: 9, minAmount: 3_000_000, maxAmount: 5_000_000, sort: 3 },
  { name: "Mayorista 4", discountPct: 10, minAmount: 6_000_000, maxAmount: 10_000_000, sort: 4 },
];

/** Precio con el descuento del tramo, redondeado a pesos. Sin precio de lista no hay precio. */
export function priceWithTier(listPrice: number | string | null | undefined, discountPct: number | null | undefined): number | null {
  if (listPrice === null || listPrice === undefined || listPrice === "") return null;
  const base = Number(listPrice);
  if (!Number.isFinite(base)) return null;
  const d = Math.min(Math.max(Number(discountPct) || 0, 0), 90);
  return Math.round(base * (1 - d / 100));
}

/**
 * Tramo sugerido para un monto de compras: el de mayor descuento cuyo rango lo contiene (sin máximo = sin tope).
 * Los tramos sin rango (ej. "Venta público") no se sugieren por monto. Puede devolver null si el monto cae en un hueco.
 */
export function suggestTier(tiers: PriceTier[], amount: number): PriceTier | null {
  const fits = tiers.filter((t) => t.active && t.minAmount !== null && amount >= t.minAmount && (t.maxAmount === null || amount <= t.maxAmount));
  return fits.sort((a, b) => b.discountPct - a.discountPct)[0] ?? null;
}

export function tierFromRow(r: any): PriceTier {
  return {
    id: r.id, name: r.name, discountPct: Number(r.discount_pct) || 0,
    minAmount: r.min_amount === null ? null : Number(r.min_amount), maxAmount: r.max_amount === null ? null : Number(r.max_amount),
    sort: r.sort ?? 0, active: r.active !== false,
  };
}

/** Descuento vigente de un cliente (0 si no tiene tramo, si está inactivo o si falta la migración 161). */
export async function customerDiscount(admin: Admin, tenantId: string, customerId: string): Promise<{ discountPct: number; tierName: string | null }> {
  const { data, error } = await admin.from("company_customers").select("price_tier:company_price_tiers(name, discount_pct, active)")
    .eq("tenant_id", tenantId).eq("id", customerId).maybeSingle();
  const tier = !error && (data as any)?.price_tier;
  if (!tier || tier.active === false) return { discountPct: 0, tierName: null };
  return { discountPct: Number(tier.discount_pct) || 0, tierName: tier.name };
}

// Mes calendario anterior en hora de Chile (UTC-3), como rango ISO [desde, hasta).
export function previousMonthRange(now: number): { from: string; to: string; label: string } {
  const local = new Date(now - 3 * 3600e3);
  const y = local.getUTCFullYear();
  const m = local.getUTCMonth(); // 0-11, mes actual
  const start = Date.UTC(m === 0 ? y - 1 : y, m === 0 ? 11 : m - 1, 1, 3);
  const end = Date.UTC(y, m, 1, 3);
  const label = new Date(start).toLocaleDateString("es-CL", { month: "long", year: "numeric", timeZone: "UTC" });
  return { from: new Date(start).toISOString(), to: new Date(end).toISOString(), label };
}
