import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";

// POST: Track a booking metric event
export async function POST(req: NextRequest) {
  const supabase = createAdminSupabase();
  const { eventType, barberId, clientId, metadata } = await req.json();

  await supabase.from("booking_metrics").insert({
    event_type: eventType,
    barber_id: barberId || null,
    client_id: clientId || null,
    metadata: metadata || {},
  });

  return NextResponse.json({ success: true });
}

// GET: Aggregated metrics
export async function GET(req: NextRequest) {
  const supabase = createAdminSupabase();
  const { searchParams } = new URL(req.url);
  const days = parseInt(searchParams.get("days") || "30");

  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data: metrics } = await supabase
    .from("booking_metrics")
    .select("event_type, barber_id")
    .gte("created_at", since.toISOString());

  // Aggregate
  const profileClicks: Record<string, number> = {};
  let firstAvailableClicks = 0;
  let totalBookings = 0;

  for (const m of metrics || []) {
    if (m.event_type === "profile_click" && m.barber_id) {
      profileClicks[m.barber_id] = (profileClicks[m.barber_id] || 0) + 1;
    }
    if (m.event_type === "first_available_click") firstAvailableClicks++;
    if (m.event_type === "booking_completed") totalBookings++;
  }

  // Get barber names
  const barberIds = Object.keys(profileClicks);
  let barberNames: Record<string, string> = {};
  if (barberIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, name")
      .in("id", barberIds);
    barberNames = Object.fromEntries((profiles || []).map((p) => [p.id, p.name]));
  }

  const topProfileClicks = Object.entries(profileClicks)
    .map(([id, clicks]) => ({ name: barberNames[id] || "Desconocido", clicks }))
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, 10);

  return NextResponse.json({
    period: `${days} dias`,
    totalBookings,
    firstAvailableClicks,
    topProfileClicks,
  });
}
