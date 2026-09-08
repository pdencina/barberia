import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const supabase = createAdminSupabase();
  const { searchParams } = new URL(req.url);
  const barberId = searchParams.get("barberId");
  const month = searchParams.get("month"); // YYYY-MM

  if (!barberId) return NextResponse.json([]);

  let query = supabase
    .from("barber_blocks")
    .select("*")
    .eq("barber_id", barberId)
    .order("date", { ascending: true });

  if (month) {
    // Use the REAL last day of the month. This used to hardcode `${month}-31`, which is
    // an invalid date for 30-day months (April, June, September, November) and February.
    // Postgres rejects the comparison, the whole query errors out, and the endpoint
    // returned an empty list — so blocks silently never showed up in those months.
    const [y, m] = month.split("-").map(Number);
    const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate(); // day 0 of next month = last day of this one
    const startDate = `${month}-01`;
    const endDate = `${month}-${String(lastDay).padStart(2, "0")}`;
    query = query.gte("date", startDate).lte("date", endDate);
  }

  const { data, error } = await query;
  if (error) {
    // Don't swallow it: an error here previously looked identical to "no blocks".
    console.error("[barber/blocks] query failed:", error.message);
    return NextResponse.json([]);
  }
  return NextResponse.json(data || []);
}

export async function POST(req: NextRequest) {
  const supabase = createAdminSupabase();
  const body = await req.json();
  const { barberId, date, allDay, startTime, endTime, reason } = body;

  const { data, error } = await supabase
    .from("barber_blocks")
    .insert({
      barber_id: barberId,
      date,
      all_day: allDay !== false,
      start_time: allDay ? null : startTime,
      end_time: allDay ? null : endTime,
      reason: reason || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const supabase = createAdminSupabase();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

  await supabase.from("barber_blocks").delete().eq("id", id);
  return NextResponse.json({ success: true });
}
