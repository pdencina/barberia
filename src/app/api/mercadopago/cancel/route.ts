import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";

// POST: Cancel a queued order on the terminal
// Also can cancel by just providing the device to clear any pending order
export async function POST(req: NextRequest) {
  const accessToken = process.env.MP_ACCESS_TOKEN;
  if (!accessToken) {
    return NextResponse.json({ error: "MP_ACCESS_TOKEN not configured" }, { status: 500 });
  }

  const body = await req.json().catch(() => ({}));
  const orderId = body.orderId;

  // If we have a specific order ID, cancel it
  if (orderId) {
    const res = await fetch(`https://api.mercadopago.com/v1/orders/${orderId}/cancel`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    const data = await res.json();

    // Update local record
    const supabase = createAdminSupabase();
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

  // If no order ID, try to cancel all pending orders for this device
  const supabase = createAdminSupabase();
  const { data: pendingOrders } = await supabase
    .from("mp_payment_intents")
    .select("mp_payment_id")
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(5);

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
