import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, canAccessBarber } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/pos-access";

// POST: Cancel a queued order on the terminal
// Also can cancel by just providing the device to clear any pending order
// SEGURIDAD: antes no pedia sesion y, sin orderId, cancelaba los 5 cobros pendientes mas recientes de CUALQUIER negocio. Ahora exige sesion del equipo,
// un cobro solo se cancela si es de un profesional del negocio de quien cancela (super admin: cualquiera) y el "cancelar todos" se acota a su negocio.
export async function POST(req: NextRequest) {
  const staff = await requireStaff();
  if (!staff.ok) return staff.response;

  const accessToken = process.env.MP_ACCESS_TOKEN;
  if (!accessToken) {
    return NextResponse.json({ error: "MP_ACCESS_TOKEN not configured" }, { status: 500 });
  }

  const body = await req.json().catch(() => ({}));
  const orderId = body.orderId;
  const supabase = createAdminSupabase();

  // If we have a specific order ID, cancel it
  if (orderId) {
    const { data: intent } = await supabase.from("mp_payment_intents").select("barber_id").eq("mp_payment_id", orderId).maybeSingle();
    if (!intent || !(await canAccessBarber((intent as any).barber_id))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

    const res = await fetch(`https://api.mercadopago.com/v1/orders/${orderId}/cancel`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    const data = await res.json();

    // Update local record
    await supabase
      .from("mp_payment_intents")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("mp_payment_id", orderId);

    return NextResponse.json({
      success: res.ok,
      status: res.status,
      response: data,
    });
  }

  // If no order ID, try to cancel all pending orders for this device (solo los de profesionales del negocio de quien cancela)
  let pending = supabase
    .from("mp_payment_intents")
    .select("mp_payment_id")
    .eq("status", "pending");
  if (staff.role !== "super_admin") {
    if (!staff.tenantId) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    const { data: team } = await supabase.from("profiles").select("id").eq("tenant_id", staff.tenantId);
    const ids = (team || []).map((m: any) => m.id);
    if (ids.length === 0) return NextResponse.json({ success: true, cancelled: 0, results: [] });
    pending = pending.in("barber_id", ids);
  }
  const { data: pendingOrders } = await pending.order("created_at", { ascending: false }).limit(5);

  const results = [];
  for (const order of pendingOrders || []) {
    if (!order.mp_payment_id) continue;
    const res = await fetch(`https://api.mercadopago.com/v1/orders/${order.mp_payment_id}/cancel`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });
    const data = await res.json();
    results.push({ orderId: order.mp_payment_id, status: res.status, response: data });

    await supabase
      .from("mp_payment_intents")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("mp_payment_id", order.mp_payment_id);
  }

  return NextResponse.json({
    success: true,
    cancelled: results.length,
    results,
  });
}
