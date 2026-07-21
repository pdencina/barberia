import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";
import { sendAppointmentReminder } from "@/lib/resend";

// This endpoint is called by Vercel Cron Jobs every hour
// It finds appointments in the next 24h that haven't been reminded yet

export async function GET(req: NextRequest) {
  // Verify cron secret (prevents unauthorized calls)
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    // In development, allow without secret
    if (process.env.NODE_ENV === "production" && !process.env.CRON_SECRET) {
      // No secret configured, allow
    } else if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const supabase = createAdminSupabase();

  // Find appointments in the next 20-28 hours that haven't been reminded
  const now = new Date();
  const in20Hours = new Date(now.getTime() + 20 * 60 * 60 * 1000);
  const in28Hours = new Date(now.getTime() + 28 * 60 * 60 * 1000);

  const { data: appointments } = await supabase
    .from("appointments")
    .select(`
      id, start_time, date,
      client:clients(id, name, email, phone),
      barber:profiles(name),
      services:appointment_services(
        service:services(name, duration)
      )
    `)
    .in("status", ["scheduled", "confirmed"])
    .eq("reminder_sent", false)
    .gte("start_time", in20Hours.toISOString())
    .lte("start_time", in28Hours.toISOString());

  if (!appointments || appointments.length === 0) {
    return NextResponse.json({ message: "No reminders to send", count: 0 });
  }

  let emailsSent = 0;
  let whatsappGenerated = 0;
  const results: Array<{ appointmentId: string; email: boolean; whatsapp: boolean }> = [];

  for (const appt of appointments) {
    const client = appt.client as any;
    const barber = appt.barber as any;
    const services = (appt.services as any[]) || [];

    if (!client) continue;

    const serviceName = services.map((s: any) => s.service?.name).filter(Boolean).join(", ") || "Servicio";
    const startTime = new Date(appt.start_time);
    let emailSent = false;
    let whatsappReady = false;

    // Send email reminder
    if (client.email) {
      try {
        await sendAppointmentReminder({
          to: client.email,
          clientName: client.name,
          barberName: barber?.name || "EstudioLevels",
          serviceName,
          date: startTime,
        });
        emailSent = true;
        emailsSent++;
      } catch (e) {
        console.error(`Error sending reminder to ${client.email}:`, e);
      }
    }

    // Mark WhatsApp as ready (actual sending via WhatsApp API would go here)
    if (client.phone) {
      whatsappReady = true;
      whatsappGenerated++;
    }

    // Mark as reminded
    await supabase
      .from("appointments")
      .update({ reminder_sent: true, reminder_sent_at: new Date().toISOString() })
      .eq("id", appt.id);

    results.push({ appointmentId: appt.id, email: emailSent, whatsapp: whatsappReady });
  }

  return NextResponse.json({
    message: `Reminders processed`,
    total: appointments.length,
    emailsSent,
    whatsappGenerated,
    results,
  });
}
