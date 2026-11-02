// Monto por cosmetico vendido que paga este negocio (tenants.cosmetic_commission_amount, migracion 122). Sin migracion o con error: 0.
export async function getCosmeticAmount(supabase: any, tenantId: string | null | undefined): Promise<number> {
  if (!tenantId) return 0;
  try {
    const { data, error } = await supabase.from("tenants").select("cosmetic_commission_amount").eq("id", tenantId).maybeSingle();
    if (error) return 0;
    const n = Number(data?.cosmetic_commission_amount);
    return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
  } catch { return 0; }
}
