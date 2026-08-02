import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";
import { sendBookingConfirmation } from "@/lib/resend";

export async function POST(req: NextRequest) {
  const supabase = createAdminSupabase();
  const body = await req.json();
  const { serviceIds, serviceId, barberId, date, startTime, clientName, clientEmail, clientPhone, notes } = body;

  // Support both single serviceId and array serviceIds
  const ids: string[] = serviceIds || (serviceId ? [serviceId] : []);

  // Validate required fields
  if (ids.length === 0 || !barberId || !date || !startTime || !clientName) {
    return NextResponse.json({ error: "Campos requeridos faltantes" }, { status: 400 });
  }

  // Get services details
  const { data: services } = await supabase
    .from("services")
    .select("id, name, price, duration")
    .in("id", ids);

  if (!services || services.length === 0) {
    return NextResponse.json({ error: "Servicios no encontrados" }, { status: 404 });
  }

  // Check for custom barber prices
  const { data: customPrices } = await supabase
    .from("barber_services")
    .select("service_id, custom_price, custom_duration")
    .eq("barber_id", barberId)
    .in("service_id", ids);

  const customMap = new Map((customPrices || []).map((c) => [c.service_id, c]));

  // Apply custom prices/durations
  const resolvedServices = services.map((s) => {
    const custom = customMap.get(s.id);
    return {
      ...s,
      price: custom?.custom_price ? Number(custom.custom_price) : Number(s.price),
      duration: custom?.custom_duration || s.duration,
    };
  });

  const totalDuration = resolvedServices.reduce((sum, s) => sum + s.duration, 0);
  const totalPrice = resolvedServices.reduce((sum, s) => sum + s.price, 0);
  const serviceNames = resolvedServices.map((s) => s.name).join(" + ");

  // Calculate end time
  const start = new Date(startTime);
  const end = new Date(start.getTime() + totalDuration * 60000);

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

  // Add services to appointment
  const serviceInserts = resolvedServices.map((s) => ({
    appointment_id: appointment!.id,
    service_id: s.id,
    price: s.price,
  }));
  await supabase.from("appointment_services").insert(serviceInserts);

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
        barberName: barber?.name || "Tu profesional",
        serviceName: serviceNames,
        date: start,
        duration: totalDuration,
        price: totalPrice,
      });
    } catch (e) {
      console.error("Error sending confirmation email:", e);
    }
  }

  // Send push notification to admin/staff (non-blocking)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://barberia-kappa-weld.vercel.app";
  try {
    await fetch(`${appUrl}/api/push/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Nueva Cita Agendada",
        body: `${clientName} - ${serviceNames} con ${barber?.name || "Profesional"} (${start.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })})`,
        url: "/dashboard/agenda",
        tag: "new-appointment",
      }),
    });
  } catch (e) {
    console.error("Error sending push:", e);
  }

  return NextResponse.json({
    success: true,
    appointmentId: appointment!.id,
    message: "Cita agendada exitosamente",
  });
}
