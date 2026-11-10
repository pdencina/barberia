import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, getCurrentUserRoleAndTenant } from "@/lib/supabase/server";
import { buscarAbonosDisponibles } from "@/lib/abonos-disponibles";

export const dynamic = "force-dynamic";

// Abonos ya pagados por un cliente que aún no se descuentan (para el Punto de Venta cuando se elige al cliente por nombre).
export async function GET(req: NextRequest) {
  const { userId, role, tenantId } = await getCurrentUserRoleAndTenant();
  if (!userId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const sp = new URL(req.url).searchParams;
  const clientId = sp.get("clientId") || "";
  if (!/^[0-9a-f-]{36}$/i.test(clientId)) return NextResponse.json({ abono: 0, abonos: [] });
  const supabase = createAdminSupabase();
  const { data: c } = await supabase.from("clients").select("tenant_id").eq("id", clientId).maybeSingle();
  if (!c) return NextResponse.json({ abono: 0, abonos: [] });
  if (role !== "super_admin" && c.tenant_id !== tenantId) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const appointmentId = sp.get("appointmentId");
  const abonos = await buscarAbonosDisponibles(supabase, { tenantId: c.tenant_id, clientId, appointmentId: appointmentId && /^[0-9a-f-]{36}$/i.test(appointmentId) ? appointmentId : null });
  return NextResponse.json({ abono: abonos.reduce((s, x) => s + x.monto, 0), abonos });
}
