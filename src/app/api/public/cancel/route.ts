import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";

// POST: Cancel an appointment by ID (public, no auth needed - uses appointment ID as token)
export async function POST(req: NextRequest) {
  const supabase = createAdminSupabase();
  const { appointmentId } = await req.json();

  if (!appointmentId) {
    return NextResponse.json({ error: "appointmentId requerido" }, { status: 400 });
  }

  // Get appointment
  const { data: appt } = await supabase
    .from("appointments")
    .select("id, status, date, start_time, client_id, barber_id")
    .eq("id", appointmentId)
    .single();

  if (!appt) {
    return NextResponse.json({ error: "Cita no encontrada" }, { status: 404 });
  }

  // Only allow cancellation of scheduled/confirmed appointments
  if (!["scheduled", "confirmed"].includes(appt.status)) {
    return NextResponse.json({ error: "Esta cita ya no puede ser cancelada" }, { status: 400 });
  }

  // Check if it's not too late (at least 2 hours before)
  const apptTime = new Date(appt.start_time);
  const now = new Date();
  const hoursUntil = (apptTime.getTime() - now.getTime()) / (1000 * 60 * 60);

  if (hoursUntil < 2) {
    return NextResponse.json({ error: "No se puede cancelar con menos de 2 horas de anticipacion" }, { status: 400 });
  }

  // Cancel the appointment
  const { error } = await supabase
    .from("appointments")
    .update({ status: "cancelled" })
    .eq("id", appointmentId);

  if (error) {
    return NextResponse.json({ error: "Error al cancelar" }, { status: 500 });
  }

  return NextResponse.json({ success: true, message: "Cita cancelada exitosamente" });
}
