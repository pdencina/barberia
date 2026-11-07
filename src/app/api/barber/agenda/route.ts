import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, canAccessBarber } from "@/lib/supabase/server";
import { newClientAppointmentIds } from "@/lib/new-client";
import { todayInChile } from "@/lib/utils";

export async function GET(req: NextRequest) {
  const supabase = createAdminSupabase();
  const { searchParams } = new URL(req.url);
  const barberId = searchParams.get("barberId");
  const date = searchParams.get("date");

  if (!barberId) return NextResponse.json([]);
  if (!(await canAccessBarber(barberId))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { data: profile } = await supabase.from("profiles").select("tenant_id").eq("id", barberId).single();
  if (!profile?.tenant_id) return NextResponse.json({ error: "Profesional no disponible" }, { status: 403 });

  let query = supabase
    .from("appointments")
    .select(`
      *,
      client:clients(id, name, phone),
      services:appointment_services(
        price,
        service:services(name, duration)
      )
    `)
    .eq("barber_id", barberId)
    .eq("tenant_id", profile.tenant_id)
    .in("status", ["scheduled", "confirmed", "in_progress", "completed"])
    .order("start_time", { ascending: true });

  if (date) {
    query = query.eq("date", date);
  } else {
    // Default: today
    const today = todayInChile();
    query = query.eq("date", today);
  }

  const { data } = await query;
  const rows = data || [];
  let newIds: Set<string> | null = new Set();
  try {
    for (let i = 0; i < rows.length; i += 100) {
      const ids = await newClientAppointmentIds(supabase, rows.slice(i, i + 100), { tenantId: profile.tenant_id, strict: true });
      for (const id of Array.from(ids)) newIds.add(id);
    }
  } catch { newIds = null; }
  return NextResponse.json(rows.map(r => ({ ...r, is_new_client: !r.client_id ? false : newIds === null ? null : newIds.has(r.id) })));
}
