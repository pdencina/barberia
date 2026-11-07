// Asientos de profesionales del plan. «Plan de 3 profesionales» = 3 personas que atienden clientes: por ejemplo 2 profesionales
// + 1 administrador que también atiende. Recepción y administradores que no atienden no usan asiento.
export const FILTRO_ATIENDEN = "role.eq.barber,and(role.eq.admin,also_attends_clients.eq.true)";

/** Cuántos asientos usa hoy el negocio (activos que atienden), sin contar a `excluirId`. */
export async function contarAsientos(sb: any, tenantId: string, excluirId?: string | null): Promise<number> {
  let q = sb.from("profiles").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("active", true).or(FILTRO_ATIENDEN);
  if (excluirId) q = q.neq("id", excluirId);
  const { count } = await q;
  return count || 0;
}

export interface EstadoAsientos { ok: boolean; usados: number; max: number | null }

/** ¿Cabe un profesional más? max = tenants.max_professionals (sin dato, no se limita). */
export async function puedeAgregarAsiento(sb: any, tenantId: string, excluirId?: string | null): Promise<EstadoAsientos> {
  const { data } = await sb.from("tenants").select("max_professionals").eq("id", tenantId).maybeSingle();
  const max = typeof data?.max_professionals === "number" ? data.max_professionals : null;
  const usados = await contarAsientos(sb, tenantId, excluirId);
  return { ok: max === null || usados < max, usados, max };
}

export const MENSAJE_SIN_ASIENTOS = "Ups, has alcanzado la cantidad máxima de profesionales de tu plan (los administradores que atienden clientes también cuentan). Mejora tu plan para agregar más.";

/** ¿Este cambio de perfil ocuparía un asiento nuevo? (reactivar a alguien o marcar a un administrador como «atiende clientes») */
export function cambioUsaAsiento(actual: { role?: string | null; active?: boolean | null; also_attends_clients?: boolean | null }, cambios: { active?: any; also_attends_clients?: any }): boolean {
  const atendia = !!actual.active && (actual.role === "barber" || (actual.role === "admin" && !!actual.also_attends_clients));
  const activo = cambios.active !== undefined ? !!cambios.active : !!actual.active;
  const atiendeAdmin = cambios.also_attends_clients !== undefined ? !!cambios.also_attends_clients : !!actual.also_attends_clients;
  const atenderaDespues = activo && (actual.role === "barber" || (actual.role === "admin" && atiendeAdmin));
  return !atendia && atenderaDespues;
}
