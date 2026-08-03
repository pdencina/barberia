import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";

const dayNames = ["Domingo", "Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado"];

// GET: Get all business hours
export async function GET() {
  const supabase = createAdminSupabase();

  const { data } = await supabase
    .from("business_hours")
    .select("*")
    .order("day_of_week");

  // If no data exists, return defaults
  if (!data || data.length === 0) {
    const defaults = dayNames.map((_, i) => ({
      day_of_week: i,
      open_time: "10:00",
      close_time: "21:00",
      is_closed: i === 0, // Sunday closed
    }));
    return NextResponse.json(defaults);
  }

  return NextResponse.json(data);
}

// PATCH: Update business hours for a specific day
export async function PATCH(req: NextRequest) {
  const supabase = createAdminSupabase();
  const body = await req.json();
  const { dayOfWeek, openTime, closeTime, isClosed } = body;

  if (dayOfWeek === undefined || dayOfWeek < 0 || dayOfWeek > 6) {
    return NextResponse.json({ error: "dayOfWeek invalido (0-6)" }, { status: 400 });
  }

  const { error } = await supabase
    .from("business_hours")
    .upsert({
      day_of_week: dayOfWeek,
      open_time: openTime || "10:00",
      close_time: closeTime || "21:00",
      is_closed: isClosed || false,
    }, { onConflict: "day_of_week" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
