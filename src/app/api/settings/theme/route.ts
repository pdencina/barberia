import { isAppTheme } from "@/lib/themes";
import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, getCurrentUserRoleAndTenant, resolveTenantForRequest } from "@/lib/supabase/server";

// POST: Cambiar el tema (claro/oscuro) del negocio.
//
// Punto (Nico, 25-sep): Configuracion > Tema, solo para Administrador — a diferencia
// del resto de Configuracion (admin + recepcion), cambiar el tema afecta la
// visualizacion de TODO el equipo del negocio, asi que se restringe explicitamente a
// admin/super_admin en vez de reusar isManagerLevel() (que tambien deja pasar a
// recepcion).
export async function POST(req: NextRequest) {
  const { role, userId } = await getCurrentUserRoleAndTenant();
  if (!userId) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (role !== "admin" && role !== "super_admin") {
    return NextResponse.json({ error: "Solo un administrador puede cambiar el tema" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({} as any));
  if (!isAppTheme(body?.theme)) return NextResponse.json({ error: "Tema inválido" }, { status: 400 });
  const theme = body.theme;

  const { tenantId, denied } = await resolveTenantForRequest(body.tenantId);
  if (denied) return NextResponse.json({ error: "No autorizado para ese negocio" }, { status: 403 });
  if (!tenantId || tenantId === "ALL") {
    return NextResponse.json({ error: "No se pudo determinar el negocio" }, { status: 400 });
  }

  const supabase = createAdminSupabase();
  const { error } = await supabase.from("tenants").update({ theme }).eq("id", tenantId);
  if (error) return NextResponse.json({ error: error.code === "42703" ? "Falta aplicar la actualización de temas (migración 148)." : "No se pudo guardar el tema" }, { status: error.code === "42703" ? 503 : 500 });

  return NextResponse.json({ success: true, theme });
}
