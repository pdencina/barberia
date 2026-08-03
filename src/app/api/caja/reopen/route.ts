import { NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";

// POST: Reopen a closed cash register for today (exceptional case)
export async function POST() {
  const supabase = createAdminSupabase();
  const today = new Date().toISOString().split("T")[0];

  // Find today's closed register
  const { data: register } = await supabase
    .from("cash_register")
    .select("id, status")
    .eq("date", today)
    .eq("status", "closed")
    .single();

  if (!register) {
    return NextResponse.json({ error: "No hay caja cerrada para hoy" }, { status: 404 });
  }

  // Reopen: set status back to open, clear closing data
  const { error } = await supabase
    .from("cash_register")
    .update({
      status: "open",
      closed_at: null,
      closing_amount: null,
      difference: null,
      expected_amount: null,
      closing_notes: "REABIERTA - " + new Date().toLocaleTimeString("es-CL"),
    })
    .eq("id", register.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, message: "Caja reabierta" });
}
