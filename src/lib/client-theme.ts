import type { SupabaseClient } from "@supabase/supabase-js";
import { type AppTheme, isAppTheme } from "@/lib/themes";

// Tema que ven los CLIENTES del negocio (página de reservas, reseñas y correos).
// - client_theme_enabled apagado (o columna sin migrar) => null: los colores de siempre.
// - encendido con client_theme elegido (migración 177) => ese diseño, aunque el equipo use otro en el sistema.
// - encendido sin client_theme => el mismo tema del sistema (migración 151).
export function resolverTemaCliente(row: any): AppTheme | null {
  if (!row || !row.client_theme_enabled) return null;
  if (isAppTheme(row.client_theme)) return row.client_theme;
  return isAppTheme(row.theme) ? row.theme : null;
}

export async function getClientColorTheme(sb: SupabaseClient, tenantId?: string | null): Promise<AppTheme | null> {
  if (!tenantId) return null;
  try {
    let r: any = await sb.from("tenants").select("theme, client_theme_enabled, client_theme").eq("id", tenantId).maybeSingle();
    if (r.error) r = await sb.from("tenants").select("theme, client_theme_enabled").eq("id", tenantId).maybeSingle(); // sin la migración 177
    if (r.error || !r.data) return null;
    return resolverTemaCliente(r.data);
  } catch { return null; }
}
