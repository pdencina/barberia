// Límite de clientes del plan (plan_limits.max_clients: Lite 100, Basic 500, Starter 1.000, Pro 5.000; Enterprise sin tope práctico).
// Se aplica cuando el equipo agrega o importa clientes. Las reservas que hace el propio cliente por el link no se bloquean (no se pierde una reserva).
export interface CupoClientes { max: number | null; usados: number; libres: number | null }

export async function cupoClientes(sb: any, tenantId: string): Promise<CupoClientes> {
  const { data: t } = await sb.from("tenants").select("plan").eq("id", tenantId).maybeSingle();
  const { data: p } = t?.plan ? await sb.from("plan_limits").select("max_clients").eq("plan", t.plan).maybeSingle() : { data: null };
  const max = typeof p?.max_clients === "number" ? p.max_clients : null;
  const { count } = await sb.from("clients").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId);
  const usados = count || 0;
  return { max, usados, libres: max === null ? null : Math.max(0, max - usados) };
}

export const mensajeLimiteClientes = (max: number | null) => `Tu plan permite hasta ${max} clientes y ya llegaste al límite. Mejora tu plan para agregar más.`;
