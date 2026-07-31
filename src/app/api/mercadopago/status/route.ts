import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";

// GET: Check payment intent status
export async function GET(req: NextRequest) {
  const supabase = createAdminSupabase();
  const { searchParams } = new URL(req.url);
  const paymentIntentId = searchParams.get("id");
  const barberId = searchParams.get("barberId");

  if (!paymentIntentId || !barberId) {
    return NextResponse.json({ error: "id and barberId required" }, { status: 400 });
  }

  // Get barber's token
  const { data: barber } = await supabase
    .from("profiles")
    .select("work_mode, mp_access_token, mp_device_id")
    .eq("id", barberId)
    .single();

  const accessToken = (barber?.work_mode === "rental" && barber?.mp_access_token)
    ? barber.mp_access_token
    : process.env.MP_ACCESS_TOKEN;

  if (!accessToken) {
    return NextResponse.json({ error: "Token no configurado" }, { status: 400 });
  }

  try {
    const res = await fetch(
      `https://api.mercadopago.com/point/integration-api/payment-intents/${paymentIntentId}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    const data = await res.json();

    // Update local record
    const status = data.state === "FINISHED" ? "approved"
      : data.state === "CANCELED" ? "cancelled"
      : data.state === "ERROR" ? "rejected"
      : "pending";

    await supabase
      .from("mp_payment_intents")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("mp_payment_id", paymentIntentId);

    return NextResponse.json({
      status,
      state: data.state,
      paymentId: data.payment?.id || null,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
