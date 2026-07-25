import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";

// GET: Returns the barber with fewest appointments today (first available)
export async function GET(req: NextRequest) {
  const supabase = createAdminSupabase();
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date") || new Date().toISOString().split("T")[0];

  // Get all active barbers
  const { data: barbers } = await supabase
    .from("profiles")
    .select("id, name")
    .eq("role", "barber")
    .eq("active", true);

  if (!barbers || barbers.length === 0) {
    return NextResponse.json({ error: "No hay barberos activos" }, { status: 404 });
  }

  // Get appointment counts per barber for this date
  const { data: appointments } = await supabase
    .from("appointments")
    .select("barber_id")
    .eq("date", date)
    .in("status", ["scheduled", "confirmed", "in_progress"]);

  // Count per barber
  const countMap: Record<string, number> = {};
  for (const b of barbers) countMap[b.id] = 0;
  for (const a of appointments || []) {
    if (countMap[a.barber_id] !== undefined) countMap[a.barber_id]++;
  }

  // Check for blocked barbers
  const { data: blocks } = await supabase
    .from("barber_blocks")
    .select("barber_id")
    .eq("date", date)
    .eq("all_day", true);

  const blockedIds = new Set((blocks || []).map((b) => b.barber_id));

  // Find barber with least appointments (excluding blocked)
  const available = barbers
    .filter((b) => !blockedIds.has(b.id))
    .map((b) => ({ ...b, appointments: countMap[b.id] || 0 }))
    .sort((a, b) => a.appointments - b.appointments);

  if (available.length === 0) {
    return NextResponse.json({ error: "Todos los barberos bloqueados" }, { status: 404 });
  }

  return NextResponse.json({
    barber: available[0],
    allAvailable: available,
  });
}
