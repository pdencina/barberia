// Comision de cosmeticos de un negocio: monto por unidad (tenants.cosmetic_commission_amount, migracion 122) y fecha desde la que se paga
// (tenants.cosmetic_commission_from, migracion 127; sin fecha = todas las ventas). Sin migracion o con error: 0 / sin fecha.
export interface CosmeticRule { amount: number; from: string | null }

const fechaChileDe = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago" }).format(new Date(iso));

export async function getCosmeticRule(supabase: any, tenantId: string | null | undefined): Promise<CosmeticRule> {
  const vacia: CosmeticRule = { amount: 0, from: null };
  if (!tenantId) return vacia;
  try {
    let { data, error } = await supabase.from("tenants").select("cosmetic_commission_amount, cosmetic_commission_from").eq("id", tenantId).maybeSingle();
    if (error) ({ data, error } = await supabase.from("tenants").select("cosmetic_commission_amount").eq("id", tenantId).maybeSingle());
    if (error) return vacia;
    const n = Number(data?.cosmetic_commission_amount);
    const f = typeof data?.cosmetic_commission_from === "string" ? data.cosmetic_commission_from.slice(0, 10) : null;
    return { amount: Number.isFinite(n) && n > 0 ? Math.round(n) : 0, from: f && /^\d{4}-\d{2}-\d{2}$/.test(f) ? f : null };
  } catch { return vacia; }
}

// Monto por cosmetico que corresponde a una venta hecha en `createdAtIso` (0 si es anterior a la fecha de inicio).
export function cosmeticAmountOn(rule: CosmeticRule, createdAtIso: string | null | undefined): number {
  if (!rule.amount) return 0;
  if (rule.from) {
    if (!createdAtIso) return 0;
    if (fechaChileDe(createdAtIso) < rule.from) return 0;
  }
  return rule.amount;
}
