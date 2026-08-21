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

  // Store notification in DB
  await supabase.from("audit_log").insert({
    action: "client_arrived",
    entity_type: "appointment",
    entity_id: appointmentId,
    description: `${clientName} llego para su cita con ${barberName}`,
    user_id: appt.barber_id,
    user_name: barberName,
    metadata: { clientName, appointmentId, barberName },
  });

  // TODO: Send push notification to barber's device
  // TODO: Send WhatsApp notification if configured
  // For now, the notification appears in the barber's dashboard/standby

  return NextResponse.json({ success: true, notified: barberName });
}
