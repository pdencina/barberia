import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const body = await req.json();

  // MercadoPago sends different notification types
  if (body.type === "payment") {
    const paymentId = body.data?.id;
    if (!paymentId) return NextResponse.json({ received: true });

    // Fetch payment details from MP
    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
    if (!accessToken) return NextResponse.json({ received: true });

    const paymentRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const payment = await paymentRes.json();

    if (payment.status === "approved") {
      const appointmentId = payment.external_reference;
      if (appointmentId) {
        const supabase = createAdminSupabase();

        // Confirm appointment
        await supabase
          .from("appointments")
          .update({ status: "confirmed" })
          .eq("id", appointmentId);

        // Create income transaction
        await supabase.from("transactions").insert({
          type: "income",
          status: "completed",
          subtotal: payment.transaction_amount,
          total: payment.transaction_amount,
          payment_method: "transfer", // Online payment
          notes: `Pago online MercadoPago #${paymentId}`,
          appointment_id: appointmentId,
        });
      }
    }
  }

  return NextResponse.json({ received: true });
}
