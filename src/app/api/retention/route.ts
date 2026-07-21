import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const supabase = createAdminSupabase();
  const { searchParams } = new URL(req.url);
  const days = parseInt(searchParams.get("days") || "30");

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  // Get all clients with their last appointment date
  const { data: clients } = await supabase
    .from("clients")
    .select("id, name, email, phone, created_at");

  if (!clients || clients.length === 0) {
    return NextResponse.json({ clients: [], stats: { total: 0, inactive: 0 } });
  }

  // Get last completed appointment for each client
  const { data: appointments } = await supabase
    .from("appointments")
    .select("client_id, date")
    .eq("status", "completed")
    .order("date", { ascending: false });

  // Build map of last visit per client
  const lastVisitMap: Record<string, string> = {};
  for (const appt of appointments || []) {
    if (!lastVisitMap[appt.client_id]) {
      lastVisitMap[appt.client_id] = appt.date;
    }
  }

  // Get total visits count per client
  const visitCountMap: Record<string, number> = {};
  for (const appt of appointments || []) {
    visitCountMap[appt.client_id] = (visitCountMap[appt.client_id] || 0) + 1;
  }

  // Filter inactive clients
  const inactiveClients = clients
    .map((client) => ({
      ...client,
      lastVisit: lastVisitMap[client.id] || null,
      totalVisits: visitCountMap[client.id] || 0,
      daysSinceVisit: lastVisitMap[client.id]
        ? Math.floor((Date.now() - new Date(lastVisitMap[client.id]).getTime()) / (1000 * 60 * 60 * 24))
        : Math.floor((Date.now() - new Date(client.created_at).getTime()) / (1000 * 60 * 60 * 24)),
    }))
    .filter((c) => c.daysSinceVisit >= days)
    .sort((a, b) => b.daysSinceVisit - a.daysSinceVisit);

  return NextResponse.json({
    clients: inactiveClients,
    stats: {
      total: clients.length,
      inactive: inactiveClients.length,
      percentage: Math.round((inactiveClients.length / clients.length) * 100),
    },
  });
}
