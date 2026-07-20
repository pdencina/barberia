import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";
import { sendBookingConfirmation } from "@/lib/resend";

export async function POST(req: NextRequest) {
  const supabase = createAdminSupabase();
  const body = await req.json();
  const { serviceId, barberId, date, startTime, clientName, clientEmail, clientPhone, notes } = body;

  // Validate required fields
  if (!serviceId || !barberId || !date || !startTime || !clientName) {
    return NextResponse.json({ error: "Campos requeridos faltantes" }, { status: 400 });
  }

  // Get service details
  const { data: service } = await supabase
    .from("services")
    .select("id, name, price, duration")
    .eq("id", serviceId)
    .single();

  if (!service) {
    return NextResponse.json({ error: "Servicio no encontrado" }, { status: 404 });
  }

  // Calculate end time
  const start = new Date(startTime);
  const end = new Date(start.getTime() + service.duration * 60000);

  // Check for conflicts (double booking prevention)
  const { data: conflicts } = await supabase
    .from("appointments")
    .select("id")
    .eq("barber_id", barberId)
    .eq("date", date)
    .in("status", ["scheduled", "confirmed", "in_progress"])
    .lt("start_time", end.toISOString())
    .gt("end_time", start.toISOString());

  if (conflicts && conflicts.length > 0) {
    return NextResponse.json({ error: "Horario no disponible. Selecciona otro." }, { status: 409 });
  }

  // Find or create client
  let clientId: string;
  if (clientEmail) {
    const { data: existingClient } = await supabase
      .from("clients")
      .select("id")
      .eq("email", clientEmail)
      .single();

    if (existingClient) {
      clientId = existingClient.id;
      // Update phone if provided
      if (clientPhone) {
        await supabase.from("clients").update({ phone: clientPhone }).eq("id", clientId);
      }
    } else {
      const { data: newClient } = await supabase
        .from("clients")
        .insert({ name: clientName, email: clientEmail, phone: clientPhone || null })
        .select("id")
        .single();
      clientId = newClient!.id;
    }
  } else {
    const { data: newClient } = await supabase
      .from("clients")
      .insert({ name: clientName, phone: clientPhone || null })
      .select("id")
      .single();
    clientId = newClient!.id;
  }

  // Create appointment
  const { data: appointment, error } = await supabase
    .from("appointments")
    .insert({
      client_id: clientId,
      barber_id: barberId,
      date,
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      status: "scheduled",
      notes: notes || null,
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: "Error creando la cita" }, { status: 500 });
  }

  // Add service to appointment
  await supabase.from("appointment_services").insert({
    appointment_id: appointment!.id,
    service_id: service.id,
    price: service.price,
  });

  // Get barber name for email
  const { data: barber } = await supabase
    .from("profiles")
    .select("name")
    .eq("id", barberId)
    .single();

  // Send confirmation email (non-blocking)
  if (clientEmail) {
    try {
      await sendBookingConfirmation({
        to: clientEmail,
        clientName,
        barberName: barber?.name || "EstudioLevels",
        serviceName: service.name,
        date: start,
        duration: service.duration,
        price: Number(service.price),
      });
    } catch (e) {
      console.error("Error sending confirmation email:", e);
    }
  }

  return NextResponse.json({
    success: true,
    appointmentId: appointment!.id,
    message: "Cita agendada exitosamente",
  });
}
