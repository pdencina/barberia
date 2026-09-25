import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, resolveTenantForRequest } from "@/lib/supabase/server";

// GET: Get all clients with phones for WhatsApp broadcast
export async function GET(req: NextRequest) {
  const supabase = createAdminSupabase();
  const { searchParams } = new URL(req.url);
  // SEGURIDAD: nunca confiar directo en el tenantId de la URL — resolveTenantForRequest lo
  // reemplaza por el negocio real del usuario logueado salvo que sea super_admin.
  const { tenantId } = await resolveTenantForRequest(searchParams.get("tenantId"));

  // Never return contacts across all businesses. Without a concrete tenant, return an
  // empty list instead of everyone (this is the same cross-business leak that let one
  // business broadcast to 647 people from other salons).
  if (!tenantId || tenantId === "ALL") {
    return NextResponse.json([]);
  }

  // Get clients with phone numbers, scoped to this business.
  let query = supabase
    .from("clients")
    .select("id, name, phone, email")
    .not("phone", "is", null)
    .eq("tenant_id", tenantId);
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
