import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, getCurrentUserRoleAndTenant } from "@/lib/supabase/server";

// Abono pagado de una cita (para restarlo en el Punto de Venta). Solo informa; el servidor lo vuelve a
// verificar en /api/pos/checkout.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { userId, role, tenantId } = await getCurrentUserRoleAndTenant();
  if (!userId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const supabase = createAdminSupabase();
  const { data: a } = await supabase.from("appointments").select("tenant_id, deposit_amount, deposit_status").eq("id", params.id).maybeSingle();
  if (!a) return NextResponse.json({ abono: 0 });
  if (role !== "super_admin" && a.tenant_id !== tenantId) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const abono = a.deposit_status === "paid" ? Math.max(0, Number(a.deposit_amount) || 0) : 0;
  return NextResponse.json({ abono });
}
