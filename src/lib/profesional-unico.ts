// Negocio independiente (una sola persona atiende): todos sus servicios públicos se pueden reservar,
// aunque tenga una lista de «servicios asignados» antigua donde no esté marcado el servicio nuevo.
export const atiende = (p: { role?: string | null; active?: boolean | null; also_attends_clients?: boolean | null }) =>
  p.active !== false && (p.role === "barber" || ((p.role === "admin" || p.role === "super_admin") && p.also_attends_clients === true));

/** Ante cualquier error responde false: se respeta la lista de asignados, como siempre. */
export async function esUnicoProfesional(sb: any, tenantId: string | null | undefined): Promise<boolean> {
  if (!tenantId) return false;
  const { data, error } = await sb.from("profiles").select("role, active, also_attends_clients").eq("tenant_id", tenantId).eq("active", true);
  return !error && (data || []).filter(atiende).length === 1;
}
