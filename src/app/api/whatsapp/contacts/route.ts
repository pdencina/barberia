import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";
import { getTenantFromRequest } from "@/lib/tenant-filter";

// GET: Get all clients with phones for WhatsApp broadcast
export async function GET(req: NextRequest) {
  const supabase = createAdminSupabase();
  const tenantId = await getTenantFromRequest(req);

  // Get clients with phone numbers
  let query = supabase
    .from("clients")
    .select("id, name, phone, email")
    .not("phone", "is", null);
  if (tenantId) query = query.eq("tenant_id", tenantId);
  query = query.neq("phone", "").order("name");

  const { data: clients } = await query;

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
