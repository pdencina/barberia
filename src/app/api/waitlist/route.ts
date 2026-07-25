import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";

// GET: Admin view of waitlist
export async function GET(req: NextRequest) {
  const supabase = createAdminSupabase();
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") || "waiting";

  const today = new Date().toISOString().split("T")[0];

  let query = supabase
    .from("waitlist")
    .select(`
      *,
      service:services(name),
      barber:profiles(name)
    `)
    .gte("preferred_date", today)
    .order("preferred_date", { ascending: true });

  if (status !== "all") {
    query = query.eq("status", status);
  }

  const { data } = await query;
  return NextResponse.json(data || []);
}

// PATCH: Update waitlist entry status
export async function PATCH(req: NextRequest) {
  const supabase = createAdminSupabase();
  const body = await req.json();
  const { id, status } = body;

  const { error } = await supabase
    .from("waitlist")
    .update({
      status,
      notified_at: status === "notified" ? new Date().toISOString() : undefined,
    })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
