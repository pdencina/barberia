import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const supabase = createAdminSupabase();
  const { searchParams } = new URL(req.url);
  const barberId = searchParams.get("barberId");
  const date = searchParams.get("date");

  if (!barberId) return NextResponse.json([]);

  let query = supabase
    .from("appointments")
    .select(`
      *,
      client:clients(name, phone),
      services:appointment_services(
        price,
        service:services(name, duration)
      )
    `)
    .eq("barber_id", barberId)
    .in("status", ["scheduled", "confirmed", "in_progress", "completed"])
    .order("start_time", { ascending: true });

  if (date) {
    query = query.eq("date", date);
  } else {
    // Default: today
    const today = new Date().toISOString().split("T")[0];
    query = query.eq("date", today);
  }

  const { data } = await query;
  return NextResponse.json(data || []);
}
