import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, getCurrentTenantId, resolveTenantForRequest, isManagerLevel } from "@/lib/supabase/server";
import { todayInChile, chileDateOffset, chileDayBoundsUtc } from "@/lib/utils";

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

  // Chile's calendar "today"/"yesterday" — not the server's UTC date (Vercel runs in
  // UTC, which used to flip these ~3-4h before real midnight in Chile). See lib/utils.ts.
  const todayStr = todayInChile();
  const yesterdayStr = chileDateOffset(-1);
  const todayBounds = chileDayBoundsUtc(todayStr);
  const yesterdayBounds = chileDayBoundsUtc(yesterdayStr);

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
    .gte("created_at", todayBounds.startUtc)
    .lt("created_at", todayBounds.endUtc));
  const todayIncome = (todayTx || []).reduce((s: number, t: any) => s + Number(t.total), 0);

  // Yesterday income
  const { data: yesterdayTx } = await withTenant(supabase
    .from("transactions")
    .select("total")
    .eq("type", "income")
    .eq("status", "completed")
    .gte("created_at", yesterdayBounds.startUtc)
    .lt("created_at", yesterdayBounds.endUtc));
  const yesterdayIncome = (yesterdayTx || []).reduce((s: number, t: any) => s + Number(t.total), 0);

  // New clients today
  const { count: newClientsToday } = await withTenant(supabase
    .from("clients")
    .select("id", { count: "exact", head: true })
    .gte("created_at", todayBounds.startUtc)
    .lt("created_at", todayBounds.endUtc));

  const { count: newClientsYesterday } = await withTenant(supabase
    .from("clients")
    .select("id", { count: "exact", head: true })
    .gte("created_at", yesterdayBounds.startUtc)
    .lt("created_at", yesterdayBounds.endUtc));

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
  const { data: serviceItems } = await supabase
    .from("transaction_items")
    .select("description, quantity")
    .not("service_id", "is", null)
    .gte("created_at", chileDayBoundsUtc(chileDateOffset(-30)).startUtc);

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
    const dayStr = chileDateOffset(-i);
    const dayBounds = chileDayBoundsUtc(dayStr);
    const { data: dayTx } = await withTenant(supabase
      .from("transactions")
      .select("total")
      .eq("type", "income")
      .eq("status", "completed")
      .gte("created_at", dayBounds.startUtc)
      .lt("created_at", dayBounds.endUtc));
    const dayTotal = (dayTx || []).reduce((sum: number, t: any) => sum + Number(t.total), 0);
    // Weekday from the noon-UTC instant of that calendar date, so it never shifts off
    // by a day regardless of the server's own timezone.
    const weekday = new Date(`${dayStr}T12:00:00Z`).getUTCDay();
    weekData.push({ day: dayNames[weekday], date: dayStr, total: dayTotal });
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
