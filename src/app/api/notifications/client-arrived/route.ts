import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";

// POST: Notify barber that their client has arrived
export async function POST(req: NextRequest) {
  const supabase = createAdminSupabase();
  const { appointmentId, clientName, barberName } = await req.json();

  if (!appointmentId) {
    return NextResponse.json({ error: "appointmentId required" }, { status: 400 });
  }

  // Get appointment details to find the barber
  const { data: appt } = await supabase
    .from("appointments")
    .select("barber_id, start_time")
    .eq("id", appointmentId)
    .single();

  if (!appt?.barber_id) {
    return NextResponse.json({ error: "Cita sin profesional asignado" }, { status: 400 });
  }

  // Send real push notification to barber
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://re-booking.cl";
    await fetch(`${baseUrl}/api/push/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: appt.barber_id,
        title: "Tu cliente llego!",
        body: `${clientName} esta esperando.`,
        url: "/dashboard/mi-agenda",
      }),
    });
  } catch (e) {
    console.error("Error sending push:", e);
  }

  // Store notification in audit log
  await supabase.from("audit_log").insert({
    action: "client_arrived",
    entity_type: "appointment",
    entity_id: appointmentId,
    description: `${clientName} llego para su cita con ${barberName}`,
    user_id: appt.barber_id,
    user_name: barberName,
    metadata: { clientName, appointmentId, barberName },
  });

  return NextResponse.json({ success: true, notified: barberName });
}
