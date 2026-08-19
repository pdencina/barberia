import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = createAdminSupabase();
  const { ids } = await req.json();

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "ids required" }, { status: 400 });
  }

  // Delete related records first (respect foreign keys)
  await supabase.from("loyalty_points").delete().in("client_id", ids);
  await supabase.from("appointment_services").delete().in(
    "appointment_id",
    (await supabase.from("appointments").select("id").in("client_id", ids)).data?.map((a) => a.id) || []
  );
  await supabase.from("appointments").delete().in("client_id", ids);
  await supabase.from("reviews").delete().in("client_id", ids);
  await supabase.from("transactions").update({ client_id: null }).in("client_id", ids);

  // Now delete clients
  const { error, count } = await supabase
    .from("clients")
    .delete()
    .in("id", ids);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, deleted: count || ids.length });
}
