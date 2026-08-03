import { NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";

// GET: Get all clients with phones for WhatsApp broadcast
export async function GET() {
  const supabase = createAdminSupabase();

  // Get clients with phone numbers
  const { data: clients } = await supabase
    .from("clients")
    .select("id, name, phone, email")
    .not("phone", "is", null)
    .neq("phone", "")
    .order("name");

  // Get last visit for each client
  const clientIds = (clients || []).map((c) => c.id);

  let lastVisits: Record<string, string> = {};
  if (clientIds.length > 0) {
    const { data: appointments } = await supabase
      .from("appointments")
      .select("client_id, date")
      .in("client_id", clientIds)
      .eq("status", "completed")
      .order("date", { ascending: false });

    // Get most recent date per client
    for (const appt of appointments || []) {
      if (!lastVisits[appt.client_id]) {
        lastVisits[appt.client_id] = appt.date;
      }
    }
  }

  const result = (clients || []).map((c) => ({
    id: c.id,
    name: c.name,
    phone: c.phone,
    email: c.email,
    lastVisit: lastVisits[c.id] || null,
  }));

  return NextResponse.json(result);
}
