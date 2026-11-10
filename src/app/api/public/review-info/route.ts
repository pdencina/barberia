import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";
import { getClientColorTheme } from "@/lib/client-theme";

export const dynamic = "force-dynamic";

// Datos mínimos para pintar la página de reseñas: el tema del negocio (solo si activó "colores para tus clientes") y su nombre.
// No devuelve nada personal; el id de la cita es el mismo que viene en el link del correo.
export async function GET(req: NextRequest) {
  const id = new URL(req.url).searchParams.get("id") || "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ color_theme: null, business_name: null });
  const sb = createAdminSupabase();
  const { data: cita } = await sb.from("appointments").select("tenant_id").eq("id", id).maybeSingle();
  const tenantId = (cita as any)?.tenant_id as string | undefined;
  if (!tenantId) return NextResponse.json({ color_theme: null, business_name: null });
  const [color_theme, { data: t }] = await Promise.all([
    getClientColorTheme(sb, tenantId),
    sb.from("tenants").select("name").eq("id", tenantId).maybeSingle(),
  ]);
  return NextResponse.json({ color_theme, business_name: (t as any)?.name ?? null });
}
