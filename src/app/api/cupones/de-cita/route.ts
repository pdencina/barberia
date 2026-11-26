import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, requireRole } from "@/lib/supabase/server";
import { cuponDeCita } from "@/lib/cupon-cita";

// Punto de Venta: ¿la cita que se está cobrando (o la de HOY de ese cliente) se reservó con un código? Devuelve cuál, para aplicarlo solo.
export async function GET(req: NextRequest) {
  const g = await requireRole(["admin", "super_admin", "receptionist", "barber"]);
  if (!g.ok) return g.response;
  const sp = new URL(req.url).searchParams;
  const appointmentId = sp.get("appointmentId") || "";
  const clientId = sp.get("clientId") || "";
  const barberId = sp.get("barberId") || "";
  const amount = Math.max(0, Number(sp.get("amount")) || 0);
  const sb = createAdminSupabase();
  let q = sb.from("appointments").select("id, client_id").not("coupon_id", "is", null).neq("status", "cancelled");
  if (g.role !== "super_admin") q = q.eq("tenant_id", g.tenantId);
  if (clientId) q = q.eq("client_id", clientId);
  if (appointmentId) q = q.eq("id", appointmentId);
  else if (clientId) {
    const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago" }).format(new Date());
    q = q.eq("date", hoy);
    if (barberId) q = q.eq("barber_id", barberId);
  } else return NextResponse.json({ cupon: null });
  const { data } = await q.order("start_time").limit(5);
  for (const a of data || []) {
    // Si esa cita ya se cobró, no se vuelve a ofrecer.
    const { data: ya } = await sb.from("transactions").select("id").eq("appointment_id", a.id).eq("status", "completed").limit(1);
    if (ya?.length) continue;
    const c = await cuponDeCita(sb, a.id, amount);
    if (c) return NextResponse.json({ cupon: { ...c, appointmentId: a.id } });
  }
  return NextResponse.json({ cupon: null });
}
