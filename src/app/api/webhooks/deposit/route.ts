import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";

/**
 * MercadoPago Webhook for deposit payments.
 * Called by MP when payment status changes.
 * 
 * Flow:
 * 1. MP sends notification with payment ID
 * 2. We fetch payment details from MP
 * 3. If approved → create appointment + mark deposit as paid
 * 4. Send confirmation email to client
 */
export async function POST(req: NextRequest) {
  const supabase = createAdminSupabase();

  try {
    const body = await req.json();

    // MP sends different notification types
    const topic = body.type || body.topic;
    const paymentId = body.data?.id || body.resource?.split("/").pop();

    if (!paymentId || (topic !== "payment" && topic !== "merchant_order")) {
      return NextResponse.json({ ok: true }); // Acknowledge but ignore non-payment notifications
    }

    // We need to find which tenant this payment belongs to
    // The external_reference in the preference contains all booking data
    // First, get payment details from MP to find the external_reference

    // Try to get payment info - we need the access token
    // Since we don't know which tenant yet, get all tokens and try
    const { data: allSettings } = await supabase
      .from("tenant_settings")
      .select("tenant_id, mp_access_token")
      .not("mp_access_token", "is", null);

    let paymentData: any = null;
    let usedToken: string = "";

    for (const setting of allSettings || []) {
      if (!setting.mp_access_token) continue;
      const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: { Authorization: `Bearer ${setting.mp_access_token}` },
      });
      if (res.ok) {
        paymentData = await res.json();
        usedToken = setting.mp_access_token;
        break;
      }
    }

    if (!paymentData) {
      console.error("Deposit webhook: payment not found", paymentId);
      return NextResponse.json({ ok: true });
    }

    // Only process approved payments
    if (paymentData.status !== "approved") {
      console.log("Deposit webhook: payment not approved yet", paymentData.status);
      return NextResponse.json({ ok: true });
    }

    // Parse external_reference to get booking details
    let bookingData: any;
    try {
      bookingData = JSON.parse(paymentData.external_reference);
    } catch {
      console.error("Deposit webhook: invalid external_reference", paymentData.external_reference);
      return NextResponse.json({ ok: true });
    }

    const {
      barberId,
      clientName,
      clientEmail,
      clientPhone,
      serviceIds,
      date,
      startTime,
      notes,
      totalPrice,
      depositAmount,
      tenantId,
    } = bookingData;

    // Find or create client
    let clientId: string | null = null;
    if (clientEmail) {
      const { data: existingClient } = await supabase
        .from("clients")
        .select("id")
        .eq("email", clientEmail)
        .single();

      if (existingClient) {
        clientId = existingClient.id;
        if (clientPhone) {
          await supabase.from("clients").update({ phone: clientPhone }).eq("id", clientId);
        }
      } else {
        const { data: newClient } = await supabase
          .from("clients")
          .insert({ name: clientName, email: clientEmail, phone: clientPhone || null, tenant_id: tenantId })
          .select("id")
          .single();
        clientId = newClient?.id || null;
      }
    } else {
      const { data: newClient } = await supabase
        .from("clients")
        .insert({ name: clientName, phone: clientPhone || null, tenant_id: tenantId })
        .select("id")
        .single();
      clientId = newClient?.id || null;
    }

    // Calculate end time
    const { data: services } = await supabase
      .from("services")
      .select("duration")
      .in("id", serviceIds);

    const totalDuration = (services || []).reduce((sum, s) => sum + (s.duration || 30), 0);
    const startDate = new Date(`${date}T${startTime}`);
    const endDate = new Date(startDate.getTime() + totalDuration * 60 * 1000);

    // Create confirmed appointment with deposit info
    const { data: appointment, error: apptError } = await supabase
      .from("appointments")
      .insert({
        client_id: clientId,
        barber_id: barberId,
        date,
        start_time: startDate.toISOString(),
        end_time: endDate.toISOString(),
        status: "confirmed",
        notes: notes || null,
        tenant_id: tenantId,
        deposit_amount: depositAmount,
        deposit_status: "paid",
        deposit_payment_id: String(paymentId),
        deposit_paid_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (apptError) {
      console.error("Deposit webhook: error creating appointment", apptError);
      return NextResponse.json({ ok: true });
    }

    // Create appointment_services
    if (appointment) {
      const { data: serviceDetails } = await supabase
        .from("services")
        .select("id, price")
        .in("id", serviceIds);

      const serviceInserts = (serviceDetails || []).map((s) => ({
        appointment_id: appointment.id,
        service_id: s.id,
        price: s.price,
      }));

      await supabase.from("appointment_services").insert(serviceInserts);
    }

    // Log in audit
    await supabase.from("audit_log").insert({
      action: "deposit_paid",
      entity_type: "appointment",
      entity_id: appointment?.id || "",
      description: `Abono $${depositAmount.toLocaleString("es-CL")} pagado por ${clientName} — Cita confirmada automaticamente`,
      user_name: clientName,
      metadata: { paymentId, depositAmount, totalPrice, barberId, date },
    });

    // Send confirmation email
    if (clientEmail) {
      try {
        const { data: barber } = await supabase.from("profiles").select("name").eq("id", barberId).single();
        const { sendBookingConfirmation } = await import("@/lib/resend");
        const serviceNames = (await supabase.from("services").select("name").in("id", serviceIds)).data?.map((s) => s.name).join(" + ") || "";

        await sendBookingConfirmation({
          to: clientEmail,
          clientName,
          barberName: barber?.name || "Tu profesional",
          serviceName: serviceNames,
          date: new Date(date + "T12:00:00").toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long" }) as any,
          duration: totalDuration,
          price: totalPrice,
          appointmentId: appointment?.id || "",
        });
      } catch (e) {
        console.error("Error sending confirmation email:", e);
      }
    }

    return NextResponse.json({ ok: true, appointmentId: appointment?.id });
  } catch (error: any) {
    console.error("Deposit webhook error:", error);
    return NextResponse.json({ ok: true }); // Always return 200 to MP
  }
}
