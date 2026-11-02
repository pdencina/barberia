import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, getCurrentUserRoleAndTenant, resolveTenantForRequest } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Monto fijo por unidad que gana el profesional al vender un cosmetico (cada negocio define el suyo; 0 = sin comision).
// Solo el administrador lo cambia. El negocio sale SIEMPRE de la sesion. Si falta la migracion 122, responde migrationMissing.
export async function GET(req: NextRequest) {
  const { role } = await getCurrentUserRoleAndTenant();
  if (role !== "admin" && role !== "super_admin" && role !== "receptionist") return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const { tenantId } = await resolveTenantForRequest(new URL(req.url).searchParams.get("tenantId"));
  if (!tenantId || tenantId === "ALL") return NextResponse.json({ amount: 0, migrationMissing: false });
  const { data, error } = await createAdminSupabase().from("tenants").select("cosmetic_commission_amount").eq("id", tenantId).single();
  if (error) return NextResponse.json({ amount: 0, migrationMissing: /column .* does not exist|schema cache/i.test(error.message) });
  return NextResponse.json({ amount: Number((data as any)?.cosmetic_commission_amount) || 0, migrationMissing: false });
}

export async function POST(req: NextRequest) {
  const { role } = await getCurrentUserRoleAndTenant();
  if (role !== "admin" && role !== "super_admin") return NextResponse.json({ error: "Solo el administrador puede cambiar esto" }, { status: 403 });
  const body = await req.json().catch(() => ({} as any));
  const { tenantId } = await resolveTenantForRequest(body.tenantId);
  if (!tenantId || tenantId === "ALL") return NextResponse.json({ error: "No se pudo determinar el negocio" }, { status: 400 });
  const amount = Number(body.amount);
  if (!Number.isInteger(amount) || amount < 0 || amount > 1_000_000) return NextResponse.json({ error: "El monto debe ser un número entero de 0 a 1.000.000" }, { status: 400 });
  const { error } = await createAdminSupabase().from("tenants").update({ cosmetic_commission_amount: amount }).eq("id", tenantId);
  if (error) return NextResponse.json({ error: "Falta aplicar la migración 122 en la base de datos." }, { status: 409 });
  return NextResponse.json({ success: true, amount });
}
