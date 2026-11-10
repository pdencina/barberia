import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, requireTenantRole } from "@/lib/supabase/server";
import { limpiarSecciones, generarCodigoNegocio } from "@/lib/totem";

// GET/POST: configuracion del totem del negocio (solo administrador).
export async function GET(req: NextRequest) {
  const guard = await requireTenantRole(["admin", "super_admin"], new URL(req.url).searchParams.get("tenantId"));
  if (!guard.ok) return guard.response;
  const { data, error } = await createAdminSupabase().from("tenants").select("kiosk_code, kiosk_enabled, kiosk_info").eq("id", guard.tenantId).maybeSingle();
  if (error) return NextResponse.json({ falta_migracion: true, codigo: null, enabled: false, info: [] });
  return NextResponse.json({ codigo: (data as any)?.kiosk_code || null, enabled: !!(data as any)?.kiosk_enabled, info: limpiarSecciones((data as any)?.kiosk_info) });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const guard = await requireTenantRole(["admin", "super_admin"], body.tenantId);
  if (!guard.ok) return guard.response;
  const update: Record<string, any> = { kiosk_enabled: body.enabled === true, kiosk_info: limpiarSecciones(body.info) };
  if (body.nuevoCodigo === true) update.kiosk_code = generarCodigoNegocio(); // los equipos ya configurados dejan de abrir: hay que escribir el nuevo
  const { error } = await createAdminSupabase().from("tenants").update(update).eq("id", guard.tenantId);
  if (error) return NextResponse.json({ error: /kiosk/i.test(error.message) ? "Falta aplicar la migración 162" : "No se pudo guardar" }, { status: 500 });
  return NextResponse.json({ ok: true, ...(update.kiosk_code ? { codigo: update.kiosk_code } : {}) });
}
