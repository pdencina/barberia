import { NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";

export async function GET() {
  const supabase = createAdminSupabase();

  // Use UTC dates (same as Supabase)
  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];
  const firstOfMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01T00:00:00`;

  // Weekly sales (last 7 days)
  const weekData: Array<{ day: string; total: number }> = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i);
    const dayStr = d.toISOString().split("T")[0];

    const { data: dayTx } = await supabase
      .from("transactions")
      .select("total")
      .eq("type", "income")
      .eq("status", "completed")
      .gte("created_at", `${dayStr}T00:00:00`)
      .lte("created_at", `${dayStr}T23:59:59`);

    const dayTotal = (dayTx || []).reduce((sum, t) => sum + Number(t.total), 0);
    const dayNames = ["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"];
    weekData.push({ day: dayNames[d.getUTCDay()], total: dayTotal });
  }

  // Today = last entry of week chart
  const todayIncome = weekData[weekData.length - 1]?.total || 0;

  // Month income
  const { data: monthTx } = await supabase
    .from("transactions")
    .select("total")
    .eq("type", "income")
    .eq("status", "completed")
    .gte("created_at", firstOfMonth);

  const monthIncome = (monthTx || []).reduce((sum, t) => sum + Number(t.total), 0);

  // Today's appointments
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
