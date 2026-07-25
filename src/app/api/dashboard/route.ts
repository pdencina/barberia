import { NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";

export async function GET() {
  const supabase = createAdminSupabase();

  // Use Chile timezone for date calculations
  const now = new Date();
  // Adjust for Chile timezone (UTC-4 or UTC-3 depending on DST)
  const chileOffset = -4; // Chile standard time
  const chileNow = new Date(now.getTime() + (chileOffset * 60 + now.getTimezoneOffset()) * 60000);
  
  const todayStr = chileNow.toISOString().split("T")[0];
  const todayStart = `${todayStr}T00:00:00`;
  const todayEnd = `${todayStr}T23:59:59`;
  
  const firstOfMonth = `${chileNow.getFullYear()}-${String(chileNow.getMonth() + 1).padStart(2, "0")}-01T00:00:00`;

  // Weekly sales (last 7 days)
  const weekData: Array<{ day: string; total: number }> = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(chileNow);
    d.setDate(d.getDate() - i);
    const dayStr = d.toISOString().split("T")[0];
    const dayStart = `${dayStr}T00:00:00`;
    const dayEnd = `${dayStr}T23:59:59`;

    const { data: dayTx } = await supabase
      .from("transactions")
      .select("total")
      .eq("type", "income")
      .eq("status", "completed")
      .gte("created_at", dayStart)
      .lte("created_at", dayEnd);

    const dayTotal = (dayTx || []).reduce((sum, t) => sum + Number(t.total), 0);
    const dayNames = ["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"];
    const dayName = dayNames[d.getDay()];

    weekData.push({ day: dayName, total: dayTotal });
  }

  // Today's income
  const { data: todayTx } = await supabase
    .from("transactions")
    .select("total")
    .eq("type", "income")
    .eq("status", "completed")
    .gte("created_at", todayStart)
    .lte("created_at", todayEnd);

  const todayIncome = (todayTx || []).reduce((sum, t) => sum + Number(t.total), 0);

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
