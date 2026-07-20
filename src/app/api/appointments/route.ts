import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const supabase = createServerSupabase();
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");
  const barberId = searchParams.get("barberId");

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

  if (date) query = query.eq("date", date);
  if (barberId) query = query.eq("barber_id", barberId);

  const { data, error } = await query;
  if (error) return NextResponse.json([]);
  return NextResponse.json(data || []);
}

export async function POST(req: NextRequest) {
  const supabase = createServerSupabase();
  const body = await req.json();
  const { clientId, barberId, date, startTime, serviceIds, notes } = body;

  // Get services to calculate duration
  const { data: services } = await supabase
    .from("services")
    .select("id, price, duration")
    .in("id", serviceIds);

  if (!services || services.length === 0) {
    return NextResponse.json({ error: "Servicios no encontrados" }, { status: 400 });
  }

  const totalDuration = services.reduce((sum, s) => sum + s.duration, 0);
  const start = new Date(startTime);
  const end = new Date(start.getTime() + totalDuration * 60000);

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

  return NextResponse.json(appointment, { status: 201 });
}
