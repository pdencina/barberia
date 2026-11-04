import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, getCurrentUserRoleAndTenant, resolveTenantForRequest } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Cómo se trata un producto (cosmético) vendido por un profesional de ARRIENDO. Cada negocio lo configura; apagado por defecto.
// Solo el administrador lo cambia. El negocio sale SIEMPRE de la sesión. Si falta la migración 130, responde migrationMissing.
const COLS = "rental_product_mode, rental_product_from, rental_card_to_barber";
export async function GET(req: NextRequest) {
  const { role } = await getCurrentUserRoleAndTenant();
  if (role !== "admin" && role !== "super_admin" && role !== "receptionist") return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const { tenantId } = await resolveTenantForRequest(new URL(req.url).searchParams.get("tenantId"));
  if (!tenantId || tenantId === "ALL") return NextResponse.json({ mode: "off", from: null, cardToBarber: true, migrationMissing: false });
  const { data, error } = await createAdminSupabase().from("tenants").select(COLS).eq("id", tenantId).single();
  if (error) return NextResponse.json({ mode: "off", from: null, cardToBarber: true, migrationMissing: /column .* does not exist|schema cache/i.test(error.message) });
  const d: any = data;
  return NextResponse.json({ mode: d?.rental_product_mode === "business_collects" ? "business_collects" : "off", from: d?.rental_product_from ? String(d.rental_product_from).slice(0, 10) : null, cardToBarber: d?.rental_card_to_barber !== false, migrationMissing: false });
}

export async function POST(req: NextRequest) {
  const { role } = await getCurrentUserRoleAndTenant();
  if (role !== "admin" && role !== "super_admin") return NextResponse.json({ error: "Solo el administrador puede cambiar esto" }, { status: 403 });
  const body = await req.json().catch(() => ({} as any));
  const { tenantId } = await resolveTenantForRequest(body.tenantId);
  if (!tenantId || tenantId === "ALL") return NextResponse.json({ error: "No se pudo determinar el negocio" }, { status: 400 });
  const mode = body.mode === "business_collects" ? "business_collects" : body.mode === "off" ? "off" : null;
  if (!mode) return NextResponse.json({ error: "Opción no válida" }, { status: 400 });
  const from = typeof body.from === "string" && body.from ? body.from : null;
  if (from && !/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(from)) return NextResponse.json({ error: "Fecha no válida" }, { status: 400 });
  const { error } = await createAdminSupabase().from("tenants").update({ rental_product_mode: mode, rental_product_from: from, rental_card_to_barber: body.cardToBarber !== false }).eq("id", tenantId);
  if (error) return NextResponse.json({ error: "Falta aplicar la migración 130 en la base de datos." }, { status: 409 });
  return NextResponse.json({ success: true });
}
