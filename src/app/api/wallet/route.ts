import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";

// GET: Get wallet data for a professional
export async function GET(req: NextRequest) {
  const supabase = createAdminSupabase();
  const { searchParams } = new URL(req.url);
  const barberId = searchParams.get("barberId");

  if (!barberId) return NextResponse.json({ error: "barberId required" }, { status: 400 });

  // Get barber info
  const { data: barber } = await supabase
    .from("profiles")
    .select("id, name, work_mode, commission_rate, rental_daily_rate")
    .eq("id", barberId)
    .single();

  if (!barber) return NextResponse.json({ error: "Profesional no encontrado" }, { status: 404 });

  const now = new Date();
  const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const lastOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const lastOfMonthStr = lastOfMonth.toISOString().split("T")[0];
  const todayStr = now.toISOString().split("T")[0];

  // Earnings this month (completed transactions)
  const { data: monthTx } = await supabase
    .from("transactions")
    .select("total, created_at")
    .eq("barber_id", barberId)
    .eq("type", "income")
    .eq("status", "completed")
    .gte("created_at", `${firstOfMonth}T00:00:00`)
    .lte("created_at", `${lastOfMonthStr}T23:59:59`);

  const totalSales = (monthTx || []).reduce((s, t) => s + Number(t.total), 0);

  // Calculate earnings based on mode
  let earned = 0;
  let mode = barber.work_mode || "commission";

  if (mode === "commission") {
    const rate = barber.commission_rate || 40;
    earned = Math.round(totalSales * (rate / 100));
  } else {
    // Rental: count days worked this month
    const { count: daysWorked } = await supabase
      .from("appointments")
      .select("date", { count: "exact", head: true })
      .eq("barber_id", barberId)
      .eq("status", "completed")
      .gte("date", firstOfMonth)
      .lte("date", todayStr);

    // For rental, earnings = sales (they keep all), minus rental fee
    earned = totalSales;
  }

  // Today's earnings
  const { data: todayTx } = await supabase
    .from("transactions")
    .select("total")
    .eq("barber_id", barberId)
    .eq("type", "income")
    .eq("status", "completed")
    .gte("created_at", `${todayStr}T00:00:00`)
    .lte("created_at", `${todayStr}T23:59:59`);

  const todayEarnings = (todayTx || []).reduce((s, t) => s + Number(t.total), 0);
  const todayCommission = mode === "commission" ? Math.round(todayEarnings * ((barber.commission_rate || 40) / 100)) : todayEarnings;

  // Projected: based on upcoming scheduled appointments
  const { data: upcomingAppts } = await supabase
    .from("appointments")
    .select("id, services:appointment_services(price)")
    .eq("barber_id", barberId)
    .in("status", ["scheduled", "confirmed"])
    .gte("date", todayStr)
    .lte("date", lastOfMonthStr);

  let projectedFromAppts = 0;
  for (const appt of upcomingAppts || []) {
    const apptTotal = ((appt as any).services || []).reduce((s: number, sv: any) => s + Number(sv.price || 0), 0);
    projectedFromAppts += apptTotal;
  }

  const projectedCommission = mode === "commission"
    ? Math.round(projectedFromAppts * ((barber.commission_rate || 40) / 100))
    : projectedFromAppts;

  const projected = earned + projectedCommission;

  // Daily breakdown (last 7 days)
  const dailyEarnings: Array<{ day: string; amount: number }> = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dayStr = d.toISOString().split("T")[0];
    const dayNames = ["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"];

    const { data: dayTx } = await supabase
      .from("transactions")
      .select("total")
      .eq("barber_id", barberId)
      .eq("type", "income")
      .eq("status", "completed")
      .gte("created_at", `${dayStr}T00:00:00`)
      .lte("created_at", `${dayStr}T23:59:59`);

    const dayTotal = (dayTx || []).reduce((s, t) => s + Number(t.total), 0);
    const dayCommission = mode === "commission" ? Math.round(dayTotal * ((barber.commission_rate || 40) / 100)) : dayTotal;

    dailyEarnings.push({ day: dayNames[d.getDay()], amount: dayCommission });
  }

  // Transaction count
  const txCount = monthTx?.length || 0;

  return NextResponse.json({
    barber: { name: barber.name, mode, commissionRate: barber.commission_rate, rentalRate: barber.rental_daily_rate },
    month: {
      earned,
      totalSales,
      projected,
      projectedFromAppts: projectedCommission,
      txCount,
      upcomingAppts: upcomingAppts?.length || 0,
    },
    today: { earnings: todayCommission, sales: todayEarnings },
    dailyEarnings,
  });
}
