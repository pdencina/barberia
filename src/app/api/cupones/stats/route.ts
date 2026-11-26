import { NextResponse } from "next/server";
import { createAdminSupabase, requireRole, resolveTenantForRequest } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/accounting";

// Medición por cupón: reservas hechas con el código, atendidas y ventas cobradas con él.
export async function GET() {
  const g = await requireRole(["admin", "super_admin"]);
  if (!g.ok) return g.response;
  const { tenantId } = await resolveTenantForRequest(null);
  if (!tenantId || tenantId === "ALL") return NextResponse.json({});
  const sb = createAdminSupabase();
  const out: Record<string, { reservas: number; atendidas: number; ventas: number; monto: number }> = {};
  const de = (id: string) => (out[id] ||= { reservas: 0, atendidas: 0, ventas: 0, monto: 0 });
  const citas = await fetchAllRows<any>(() => sb.from("appointments").select("id, coupon_id, status").eq("tenant_id", tenantId).not("coupon_id", "is", null)).catch(() => [] as any[]);
  for (const a of citas) { if (a.status === "cancelled") continue; const e = de(a.coupon_id); e.reservas++; if (a.status === "completed") e.atendidas++; }
  const txs = await fetchAllRows<any>(() => sb.from("transactions").select("id, coupon_id, total").eq("tenant_id", tenantId).eq("type", "income").eq("status", "completed").not("coupon_id", "is", null)).catch(() => [] as any[]);
  for (const t of txs) { const e = de(t.coupon_id); e.ventas++; e.monto += Number(t.total) || 0; }
  return NextResponse.json(out);
}
