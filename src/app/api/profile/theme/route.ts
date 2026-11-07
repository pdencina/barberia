import { isAppTheme } from "@/lib/themes";
import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, getCurrentUserRoleAndTenant } from "@/lib/supabase/server";

// POST: cada usuario elige SU tema (claro/oscuro) o vuelve al del negocio (theme = null).
// Solo toca el perfil del usuario logueado; nunca recibe un id desde el cliente.
export async function POST(req: NextRequest) {
  const { userId, tenantId } = await getCurrentUserRoleAndTenant();
  if (!userId) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const body = await req.json().catch(() => ({} as any));
  if (body?.theme !== null && !isAppTheme(body?.theme)) return NextResponse.json({ error: "Tema inválido" }, { status: 400 });
  const theme = body.theme;

  let update = createAdminSupabase().from("profiles").update({ theme }).eq("id", userId);
  if (tenantId) update = update.eq("tenant_id", tenantId);
  const { error } = await update;
  if (error) return NextResponse.json({ error: error.code === "23514" ? "Falta aplicar la actualización de temas (migración 148). Tu tema anterior se conserva." : "No se pudo guardar el tema" }, { status: error.code === "23514" ? 503 : 500 });

  return NextResponse.json({ success: true, theme });
}
