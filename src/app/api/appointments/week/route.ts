import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, resolveTenantForRequest } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const supabase = createAdminSupabase();
  const { searchParams } = new URL(req.url);
  // SEGURIDAD: nunca confiar directo en el tenantId de la URL — resolveTenantForRequest lo
  // reemplaza por el negocio real del usuario logueado salvo que sea super_admin.
  const { tenantId } = await resolveTenantForRequest(searchParams.get("tenantId"));
  const startDate = searchParams.get("start"); // YYYY-MM-DD (Monday)

  if (!startDate) return NextResponse.json([]);

  // Get 7 days from start
  const start = new Date(startDate);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);

  let query = supabase
    .from("appointments")
    .select(`
      id, date, start_time, end_time, status, barber_id,
      client:clients(name),
      barber:profiles(name),
      services:appointment_services(service:services(name))
    `)
    .gte("date", startDate)
    .lt("date", end.toISOString().split("T")[0])
    .in("status", ["scheduled", "confirmed", "in_progress", "completed"])
    .order("start_time", { ascending: true });

  if (tenantId && tenantId !== "ALL") query = query.eq("tenant_id", tenantId);

  const { data } = await query;

  return NextResponse.json(data || []);
}
