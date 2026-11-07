// Límite de sucursales del plan (tenants.max_branches). Una sucursal adicional se vende aparte: solo el super admin sube el límite.
export const MENSAJE_SIN_SUCURSALES = "Tu plan no incluye más sucursales. Para agregar otra, escríbenos y la activamos (tiene un costo adicional por sucursal).";

export async function puedeCrearSucursal(sb: any, tenantId: string): Promise<{ ok: boolean; usadas: number; max: number | null }> {
  const { data } = await sb.from("tenants").select("max_branches").eq("id", tenantId).maybeSingle();
  const max = typeof data?.max_branches === "number" ? data.max_branches : null;
  const { count } = await sb.from("branches").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("active", true);
  const usadas = count || 0;
  return { ok: max === null || usadas < max, usadas, max };
}
