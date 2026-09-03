import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase/server";
import { getTenantFromRequest } from "@/lib/tenant-filter";

export async function GET(req: NextRequest) {
  const supabase = createAdminSupabase();
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");
  const barberId = searchParams.get("barberId");
  const tenantId = await getTenantFromRequest(req);

  let query = supabase
    .from("appointments")
    .select(`
      *,
      client:clients(id, name, phone),
      barber:profiles(id, name),
      services:appointment_services(
        id, price,
        service:services(name, price, duration)
      )
    `)
    .order("start_time", { ascending: true });

  if (tenantId && tenantId !== "ALL") query = query.eq("tenant_id", tenantId);
  if (date) query = query.eq("date", date);
  if (barberId) query = query.eq("barber_id", barberId);

  const { data, error } = await query;
  if (error) return NextResponse.json([]);
  return NextResponse.json(data || []);
}

export async function POST(req: NextRequest) {
  const supabase = createAdminSupabase();
  const body = await req.json();
  const { clientId, barberId, date, startTime, endTime: customEndTime, serviceIds, notes, tenantId } = body;

  // Resolve tenant_id
  let resolvedTenantId = tenantId;
  if (!resolvedTenantId) {
    // Get from barber's profile
    const { data: barberProfile } = await supabase.from("profiles").select("tenant_id").eq("id", barberId).single();
    resolvedTenantId = barberProfile?.tenant_id || null;
  }

  // Get services to calculate duration (if no custom end time)
  const { data: services } = await supabase
    .from("services")
    .select("id, price, duration")
    .in("id", serviceIds);

  if (!services || services.length === 0) {
    return NextResponse.json({ error: "Servicios no encontrados" }, { status: 400 });
  }

  const totalDuration = services.reduce((sum, s) => sum + s.duration, 0);
  const start = new Date(startTime);
  // Use custom end time if provided, otherwise calculate from service duration
  const end = customEndTime ? new Date(customEndTime) : new Date(start.getTime() + totalDuration * 60000);

  // Check conflicts
  const { data: conflicts } = await supabase
    .from("appointments")
    .select("id")
    .eq("barber_id", barberId)
    .eq("date", date)
    .in("status", ["scheduled", "confirmed", "in_progress"])
    .lt("start_time", end.toISOString())
    .gt("end_time", start.toISOString());

  if (conflicts && conflicts.length > 0) {
    return NextResponse.json(
      { error: "El barbero tiene una cita en ese horario" },
      { status: 409 }
    );
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
      notes,
      tenant_id: resolvedTenantId,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Add services
  const serviceInserts = services.map((s) => ({
    appointment_id: appointment.id,
    service_id: s.id,
    price: s.price,
  }));

  await supabase.from("appointment_services").insert(serviceInserts);

  // Notify the assigned professional by push that a new appointment was booked for
  // them (e.g. reception created it). Non-blocking.
  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://re-booking.cl";
    const [{ data: barber }, { data: client }] = await Promise.all([
      supabase.from("profiles").select("name").eq("id", barberId).single(),
      clientId ? supabase.from("clients").select("name").eq("id", clientId).single() : Promise.resolve({ data: null }),
    ]);
    await fetch(`${appUrl}/api/push/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: barberId,
        title: "Nueva Cita Agendada",
        body: `${client?.name || "Cliente"} - ${start.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}`,
        url: "/dashboard/mi-agenda",
        tag: "new-appointment",
      }),
    });
  } catch (e) {
    console.error("Error sending push (dashboard booking):", e);
  }

  return NextResponse.json(appointment, { status: 201 });
}
