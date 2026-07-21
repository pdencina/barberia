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
    const startDate = `${month}-01`;
    const endDate = `${month}-31`;
    query = query.gte("date", startDate).lte("date", endDate);
  }

  const { data } = await query;
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
