import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createAdminSupabase();
  const body = await req.json();

  // Build update object dynamically
  const update: Record<string, any> = {};
  if (body.status) update.status = body.status;
  if (body.barber_id) update.barber_id = body.barber_id;
  if (body.start_time) update.start_time = body.start_time;
  if (body.end_time) update.end_time = body.end_time;
  if (body.date) update.date = body.date;
  if (body.notes !== undefined) update.notes = body.notes;

  const { data, error } = await supabase
    .from("appointments")
    .update(update)
    .eq("id", params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
