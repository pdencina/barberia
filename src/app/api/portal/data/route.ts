import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";

// GET: Get all client portal data (appointments, history, loyalty)
export async function GET(req: NextRequest) {
  const supabase = createAdminSupabase();
  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get("clientId");

  if (!clientId) {
    return NextResponse.json({ error: "clientId requerido" }, { status: 400 });
  }

  // Get client info
  const { data: client } = await supabase
    .from("clients")
    .select("id, name, email, phone, loyalty_points, created_at")
    .eq("id", clientId)
    .single();

  if (!client) {
    return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
  }

  const today = new Date().toISOString().split("T")[0];

  // Upcoming appointments
  const { data: upcoming } = await supabase
    .from("appointments")
    .select(`
      id, date, start_time, end_time, status,
      barber:profiles(name),
      services:appointment_services(service:services(name, price))
    `)
    .eq("client_id", clientId)
    .in("status", ["scheduled", "confirmed"])
    .gte("date", today)
    .order("date", { ascending: true })
    .order("start_time", { ascending: true })
    .limit(10);

  // Past appointments (last 20)
  const { data: history } = await supabase
    .from("appointments")
    .select(`
      id, date, start_time, status,
      barber:profiles(name),
      services:appointment_services(service:services(name, price))
    `)
    .eq("client_id", clientId)
    .in("status", ["completed", "cancelled", "no_show"])
    .order("date", { ascending: false })
    .limit(20);

  // Loyalty points history
  const { data: pointsHistory } = await supabase
    .from("loyalty_points")
    .select("id, points, reason, created_at")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(15);

  // Total visits
  const { count: totalVisits } = await supabase
    .from("appointments")
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId)
    .eq("status", "completed");

  return NextResponse.json({
    client: {
      name: client.name,
      email: client.email,
      phone: client.phone,
      loyaltyPoints: client.loyalty_points || 0,
      memberSince: client.created_at,
      totalVisits: totalVisits || 0,
    },
    upcoming: upcoming || [],
    history: history || [],
    pointsHistory: pointsHistory || [],
  });
}
