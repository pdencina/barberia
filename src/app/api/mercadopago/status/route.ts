import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";

// GET: Check order/payment status (Chile - Orders API)
export async function GET(req: NextRequest) {
  const supabase = createAdminSupabase();
  const { searchParams } = new URL(req.url);
  const orderId = searchParams.get("id");
  const barberId = searchParams.get("barberId");

  if (!orderId) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const accessToken = process.env.MP_ACCESS_TOKEN;
  if (!accessToken) {
    return NextResponse.json({ error: "Token no configurado" }, { status: 400 });
  }

  try {
    const res = await fetch(
      `https://api.mercadopago.com/v1/orders/${orderId}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    const data = await res.json();

    // Map order status to our internal status
    let status = "pending";
    if (data.status === "processed" || data.status === "closed") {
      // Check payment status within the order
      const payment = data.transactions?.payments?.[0];
      if (payment?.status === "approved" || payment?.status === "processed") {
        status = "approved";
      } else if (payment?.status === "rejected" || payment?.status === "cancelled") {
        status = "rejected";
      }
    } else if (data.status === "expired" || data.status === "cancelled") {
      status = "cancelled";
    }

    // Update local record
    if (status !== "pending") {
      await supabase
        .from("mp_payment_intents")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("mp_payment_id", orderId);
    }

    return NextResponse.json({
      status,
      orderStatus: data.status,
      orderStatusDetail: data.status_detail,
      paymentStatus: data.transactions?.payments?.[0]?.status || null,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
