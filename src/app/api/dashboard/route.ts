import { NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";

export async function GET() {
  const supabase = createAdminSupabase();

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  // Weekly sales (last 7 days)
  const weekData: Array<{ day: string; total: number }> = [];
  for (let i = 6; i >= 0; i--) {
    const dayStart = new Date(today);
    dayStart.setDate(dayStart.getDate() - i);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const { data: dayTx } = await supabase
      .from("transactions")
      .select("total")
      .eq("type", "income")
      .eq("status", "completed")
      .gte("created_at", dayStart.toISOString())
      .lt("created_at", dayEnd.toISOString());

    const dayTotal = (dayTx || []).reduce((sum, t) => sum + Number(t.total), 0);
    const dayName = dayStart.toLocaleDateString("es-CL", { weekday: "short" });

    weekData.push({ day: dayName.charAt(0).toUpperCase() + dayName.slice(1), total: dayTotal });
  }

  // Today's income
  const todayIncome = weekData[weekData.length - 1]?.total || 0;

  // Month income
  const { data: monthTx } = await supabase
    .from("transactions")
    .select("total")
    .eq("type", "income")
    .eq("status", "completed")
    .gte("created_at", firstOfMonth.toISOString());

  const monthIncome = (monthTx || []).reduce((sum, t) => sum + Number(t.total), 0);

  // Today's appointments
  const todayStr = today.toISOString().split("T")[0];
  const { data: todayAppointments } = await supabase
    .from("appointments")
    .select(`
      id, start_time, end_time, status,
      client:clients(name, phone),
      barber:profiles(name),
      services:appointment_services(service:services(name))
    `)
    .eq("date", todayStr)
    .in("status", ["scheduled", "confirmed", "in_progress"])
    .order("start_time", { ascending: true });

  // Counts
  const { count: totalClients } = await supabase
    .from("clients")
    .select("id", { count: "exact", head: true });

  const { count: todayApptCount } = await supabase
    .from("appointments")
    .select("id", { count: "exact", head: true })
    .eq("date", todayStr)
    .in("status", ["scheduled", "confirmed", "in_progress", "completed"]);

  const { data: lowStock } = await supabase
    .from("products")
    .select("id, name, stock, min_stock")
    .eq("active", true)
    .filter("stock", "lte", "min_stock");

  // Week total
  const weekTotal = weekData.reduce((sum, d) => sum + d.total, 0);

  return NextResponse.json({
    todayIncome,
    monthIncome,
    weekTotal,
    weekData,
    totalClients: totalClients || 0,
    todayAppointments: todayAppointments || [],
    todayApptCount: todayApptCount || 0,
    lowStock: lowStock || [],
  });
}
