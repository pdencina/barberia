import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";

// GET: Get schedule for a barber
export async function GET(req: NextRequest) {
  const supabase = createAdminSupabase();
  const { searchParams } = new URL(req.url);
  const barberId = searchParams.get("barberId");

  if (!barberId) return NextResponse.json([]);

  const { data } = await supabase
    .from("barber_schedule")
    .select("*")
    .eq("barber_id", barberId)
    .order("day_of_week");

  // If no schedule exists, return defaults (all days working 10-20)
  if (!data || data.length === 0) {
    const defaults = Array.from({ length: 7 }, (_, i) => ({
      barber_id: barberId,
      day_of_week: i,
      is_working: i !== 0, // Sunday off by default
      start_time: "10:00",
      end_time: "20:00",
      break_start: null,
      break_end: null,
    }));
    return NextResponse.json(defaults);
  }

  return NextResponse.json(data);
}

// POST: Save schedule for a barber (upsert all 7 days)
export async function POST(req: NextRequest) {
  const supabase = createAdminSupabase();
  const { barberId, schedule } = await req.json();

  if (!barberId || !schedule) {
    return NextResponse.json({ error: "barberId and schedule required" }, { status: 400 });
  }

  // Upsert each day
  for (const day of schedule) {
    await supabase
      .from("barber_schedule")
      .upsert({
        barber_id: barberId,
        day_of_week: day.day_of_week,
        is_working: day.is_working,
        start_time: day.start_time || "10:00",
        end_time: day.end_time || "20:00",
        break_start: day.break_start || null,
        break_end: day.break_end || null,
      }, { onConflict: "barber_id,day_of_week" });
  }

  return NextResponse.json({ success: true });
}
