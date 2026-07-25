import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createAdminSupabase();
  const clientId = params.id;

  // Get client details
  const { data: client } = await supabase
    .from("clients")
    .select("*")
    .eq("id", clientId)
    .single();

  if (!client) {
    return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
  }

  // Get all appointments for this client
  const { data: appointments } = await supabase
    .from("appointments")
    .select(`
      id, date, start_time, status,
      barber:profiles(name),
      services:appointment_services(
        price,
        service:services(name)
      )
    `)
    .eq("client_id", clientId)
    .order("date", { ascending: false });

  // Get all transactions for this client
  const { data: transactions } = await supabase
    .from("transactions")
    .select(`
      id, total, payment_method, created_at,
      items:transaction_items(description, total)
    `)
    .eq("client_id", clientId)
    .eq("type", "income")
    .eq("status", "completed")
    .order("created_at", { ascending: false });

  // Calculate stats
  const totalSpent = (transactions || []).reduce((sum, t) => sum + Number(t.total), 0);
  const totalVisits = (appointments || []).filter((a) => a.status === "completed").length;
  const totalNoShows = (appointments || []).filter((a) => a.status === "no_show").length;
  const totalCancelled = (appointments || []).filter((a) => a.status === "cancelled").length;
  const totalBooked = (appointments || []).length;
  const attendanceRate = totalBooked > 0 ? Math.round(((totalBooked - totalNoShows - totalCancelled) / totalBooked) * 100) : 100;
  const lastVisit = appointments?.find((a) => a.status === "completed")?.date || null;

  // Most used services
  const serviceCount: Record<string, number> = {};
  for (const appt of appointments || []) {
    for (const s of (appt.services as any[]) || []) {
      const name = s.service?.name;
      if (name) serviceCount[name] = (serviceCount[name] || 0) + 1;
    }
  }
  const favoriteServices = Object.entries(serviceCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));

  // Most visited barber
  const barberCount: Record<string, number> = {};
  for (const appt of appointments || []) {
    const name = (appt.barber as any)?.name;
    if (name) barberCount[name] = (barberCount[name] || 0) + 1;
  }
  const favoriteBarber = Object.entries(barberCount)
    .sort((a, b) => b[1] - a[1])[0];

  return NextResponse.json({
    client,
    stats: {
      totalSpent,
      totalVisits,
      totalNoShows,
      totalCancelled,
      attendanceRate,
      lastVisit,
      averageSpend: totalVisits > 0 ? Math.round(totalSpent / totalVisits) : 0,
      favoriteServices,
      favoriteBarber: favoriteBarber ? { name: favoriteBarber[0], visits: favoriteBarber[1] } : null,
    },
    appointments: (appointments || []).slice(0, 20),
    transactions: (transactions || []).slice(0, 20),
  });
}
