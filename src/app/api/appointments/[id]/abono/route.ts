import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, getCurrentUserRoleAndTenant } from "@/lib/supabase/server";
import { buscarAbonosDisponibles } from "@/lib/abonos-disponibles";

// Abono pagado al reservar que se puede descontar al cobrar esta cita (Punto de Venta o botón Cobrar del calendario).
// Reconoce el abono de la propia cita y también el que la clienta pagó por otra cita suya (si la cambió, la cancelaron y se creó otra,
// etc.). Solo informa; el servidor lo vuelve a verificar en /api/pos/checkout.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { userId, role, tenantId } = await getCurrentUserRoleAndTenant();
  if (!userId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const supabase = createAdminSupabase();
  const { data: a } = await supabase.from("appointments").select("tenant_id, client_id").eq("id", params.id).maybeSingle();
  if (!a) return NextResponse.json({ abono: 0, abonos: [] });
  if (role !== "super_admin" && a.tenant_id !== tenantId) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const abonos = await buscarAbonosDisponibles(supabase, { tenantId: a.tenant_id, clientId: a.client_id, appointmentId: params.id });
  return NextResponse.json({ abono: abonos.reduce((s, x) => s + x.monto, 0), abonos });
}
