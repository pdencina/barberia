import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, requireRole, resolveTenantForRequest } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/accounting";
import { resumirPromos } from "@/lib/promo-resultados";

export const dynamic = "force-dynamic";

// Medición por cupón: reservas hechas con el código, servicios tomados, atendidas y ventas cobradas con él.
export async function GET(req: NextRequest) {
  const g = await requireRole(["admin", "super_admin"]);
  if (!g.ok) return g.response;
  // El negocio pedido solo vale para el super admin; el resto siempre ve el suyo.
  const { tenantId } = await resolveTenantForRequest(new URL(req.url).searchParams.get("tenantId"));
  if (!tenantId || tenantId === "ALL") return NextResponse.json({});
  const sb = createAdminSupabase();
  const citas = await fetchAllRows<any>(() => sb.from("appointments").select("id, coupon_id, status").eq("tenant_id", tenantId).not("coupon_id", "is", null)).catch(() => [] as any[]);
  const lineas: any[] = [];
  for (let i = 0; i < citas.length; i += 150) {
    const ids = citas.slice(i, i + 150).map((c) => c.id);
    lineas.push(...(await fetchAllRows<any>(() => sb.from("appointment_services").select("id, appointment_id, service_id, services(name)").in("appointment_id", ids)).catch(() => [] as any[])));
  }
  const txs = await fetchAllRows<any>(() => sb.from("transactions").select("id, coupon_id, total").eq("tenant_id", tenantId).eq("type", "income").eq("status", "completed").not("coupon_id", "is", null)).catch(() => [] as any[]);
  const { data: cupones } = await sb.from("coupons").select("*").eq("tenant_id", tenantId);
  const incluidos = Object.fromEntries(((cupones || []) as any[]).map((c) => [c.id, c.conditions?.servicioIds]));
  return NextResponse.json(resumirPromos(citas, lineas, txs, incluidos));
}
