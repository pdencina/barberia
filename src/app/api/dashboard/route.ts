import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, getCurrentTenantId, resolveTenantForRequest, isManagerLevel } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  // The business-wide dashboard (today's sales, new clients, week chart) is for
  // owners/managers/reception, not for a professional — they have their own agenda.
  const { ok } = await isManagerLevel();
  if (!ok) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const supabase = createAdminSupabase();
  const { searchParams } = new URL(req.url);

  // Never trust the tenantId coming from the browser — see resolveTenantForRequest.
  const { tenantId } = await resolveTenantForRequest(searchParams.get("tenantId"));

  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split("T")[0];

  // Helper to add tenant filter (skip for super_admin "ALL")
  const withTenant = (query: any) => (tenantId && tenantId !== "ALL") ? query.eq("tenant_id", tenantId) : query;

  // Today appointments count
  const { count: todayApptCount } = await withTenant(supabase
    .from("appointments")
    .select("id", { count: "exact", head: true })
    .eq("date", todayStr));

  // Yesterday appointments count (for comparison)
  const { count: yesterdayApptCount } = await withTenant(supabase
    .from("appointments")
    .select("id", { count: "exact", head: true })
    .eq("date", yesterdayStr));

  // Today income
  const { data: todayTx } = await withTenant(supabase
    .from("transactions")
    .select("total")
    .eq("type", "income")
    .eq("status", "completed")
    .gte("created_at", `${todayStr}T00:00:00`)
    .lte("created_at", `${todayStr}T23:59:59`));
  const todayIncome = (todayTx || []).reduce((s: number, t: any) => s + Number(t.total), 0);

  // Yesterday income
  const { data: yesterdayTx } = await withTenant(supabase
    .from("transactions")
    .select("total")
    .eq("type", "income")
    .eq("status", "completed")
    .gte("created_at", `${yesterdayStr}T00:00:00`)
    .lte("created_at", `${yesterdayStr}T23:59:59`));
  const yesterdayIncome = (yesterdayTx || []).reduce((s: number, t: any) => s + Number(t.total), 0);

  // New clients today
  const { count: newClientsToday } = await withTenant(supabase
    .from("clients")
    .select("id", { count: "exact", head: true })
    .gte("created_at", `${todayStr}T00:00:00`)
    .lte("created_at", `${todayStr}T23:59:59`));

  const { count: newClientsYesterday } = await withTenant(supabase
    .from("clients")
    .select("id", { count: "exact", head: true })
    .gte("created_at", `${yesterdayStr}T00:00:00`)
    .lte("created_at", `${yesterdayStr}T23:59:59`));

  // Rescheduled today
  const { count: rescheduledToday } = await withTenant(supabase
    .from("appointments")
    .select("id", { count: "exact", head: true })
    .eq("date", todayStr)
    .eq("status", "confirmed"));

  const { count: rescheduledYesterday } = await withTenant(supabase
    .from("appointments")
    .select("id", { count: "exact", head: true })
    .eq("date", yesterdayStr)
    .eq("status", "confirmed"));

  // Cancellations today
  const { count: cancelledToday } = await withTenant(supabase
    .from("appointments")
    .select("id", { count: "exact", head: true })
    .eq("date", todayStr)
    .in("status", ["cancelled", "no_show"]));

  const { count: cancelledYesterday } = await withTenant(supabase
    .from("appointments")
    .select("id", { count: "exact", head: true })
    .eq("date", yesterdayStr)
    .in("status", ["cancelled", "no_show"]));

  // Today's agenda (upcoming appointments)
  const { data: todayAppointments } = await withTenant(supabase
    .from("appointments")
    .select(`
      id, start_time, end_time, status,
      client:clients(name),
      barber:profiles(name),
      services:appointment_services(service:services(name))
    `)
    .eq("date", todayStr)
    .in("status", ["scheduled", "confirmed", "in_progress"])
    .order("start_time", { ascending: true })
    .limit(8));

  // Top services (last 30 days)
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const { data: serviceItems } = await supabase
    .from("transaction_items")
    .select("description, quantity")
    .not("service_id", "is", null)
    .gte("created_at", thirtyDaysAgo.toISOString());

  const serviceMap: Record<string, number> = {};
  for (const item of serviceItems || []) {
    serviceMap[item.description] = (serviceMap[item.description] || 0) + (item.quantity || 1);
  }
  const topServices = Object.entries(serviceMap)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Weekly sales (last 7 days)
  const dayNames = ["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"];
  const weekData: Array<{ day: string; date: string; total: number }> = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dayStr = d.toISOString().split("T")[0];
    const { data: dayTx } = await withTenant(supabase
      .from("transactions")
      .select("total")
      .eq("type", "income")
      .eq("status", "completed")
      .gte("created_at", `${dayStr}T00:00:00`)
      .lte("created_at", `${dayStr}T23:59:59`));
    const dayTotal = (dayTx || []).reduce((sum: number, t: any) => sum + Number(t.total), 0);
    weekData.push({ day: dayNames[d.getDay()], date: dayStr, total: dayTotal });
  }

  // Calculate percentage changes
  const calcChange = (today: number, yesterday: number): number => {
    if (yesterday === 0) return today > 0 ? 100 : 0;
    return Math.round(((today - yesterday) / yesterday) * 100);
  };

  return NextResponse.json({
    greeting: true,
    stats: {
      reservasHoy: todayApptCount || 0,
      reservasChange: calcChange(todayApptCount || 0, yesterdayApptCount || 0),
      ventasHoy: todayIncome,
      ventasChange: calcChange(todayIncome, yesterdayIncome),
      clientesNuevos: newClientsToday || 0,
      clientesChange: calcChange(newClientsToday || 0, newClientsYesterday || 0),
      reagendamientos: rescheduledToday || 0,
      reagendamientosChange: calcChange(rescheduledToday || 0, rescheduledYesterday || 0),
      cancelaciones: cancelledToday || 0,
      cancelacionesChange: calcChange(cancelledToday || 0, cancelledYesterday || 0),
    },
    todayAppointments: todayAppointments || [],
    topServices,
    weekData,
  });
}
