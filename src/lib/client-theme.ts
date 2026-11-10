import type { SupabaseClient } from "@supabase/supabase-js";
import { type AppTheme, isAppTheme } from "@/lib/themes";

// Tema que deben usar los correos y la página de reservas del negocio. null = los colores de siempre
// (opción apagada o columna sin migrar). Requiere la migración 151.
export async function getClientColorTheme(sb: SupabaseClient, tenantId?: string | null): Promise<AppTheme | null> {
  if (!tenantId) return null;
  try {
    const { data, error } = await sb.from("tenants").select("theme, client_theme_enabled").eq("id", tenantId).maybeSingle();
    if (error || !data || !(data as any).client_theme_enabled) return null;
    const t = (data as any).theme;
    return isAppTheme(t) ? t : null;
  } catch { return null; }
}
