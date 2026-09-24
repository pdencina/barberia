import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, getCurrentTenantId, resolveTenantForRequest, isManagerLevel } from "@/lib/supabase/server";
import { todayInChile, chileDayBoundsUtc, dateStrOffset } from "@/lib/utils";

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

  // Punto 8 (Pablo): antes el Dashboard solo mostraba el dia actual, sin forma de
  // revisar ventas/reservas/servicios de un dia anterior. Acepta ?date=YYYY-MM-DD y
  // recalcula "el dia elegido" / "el dia anterior a ese" en torno a el; sin parametro
  // (o si viene invalido) sigue siendo el dia de hoy en Chile, como antes. No se usa el
  // dato del navegador/servidor (Vercel corre en UTC) — ver lib/utils.ts.
  const requestedDate = searchParams.get("date");
  const todayStr = requestedDate && /^\d{4}-\d{2}-\d{2}$/.test(requestedDate) ? requestedDate : todayInChile();
  const yesterdayStr = dateStrOffset(todayStr, -1);
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

  // Top services (last 30 days).
  // Punto 7 (Pablo): "Top servicios" no mostraba datos. transaction_items no tiene
  // columna created_at (nunca se agrego en ninguna migracion) — el filtro
  // .gte("created_at", ...) contra esa tabla fallaba en Postgrest y, como solo se
  // desestructuraba `data` (no `error`), la respuesta vacia se tomaba silenciosamente
  // como "sin datos". Ademas faltaba el filtro de tenant, lo que habria mezclado los
  // servicios de otros negocios. Se filtra por la transaccion padre (que si tiene
  // created_at y tenant_id) y se recorren sus items en memoria.
  let topServicesQuery = supabase
    .from("transactions")
    .select("items:transaction_items(description, quantity, service_id)")
    .eq("type", "income")
    .eq("status", "completed")
    // Window ends at the selected day (todayStr), not always the real "now" — so
    // picking a past date shows that day's own trailing 30-day window, not a mix that
    // includes days after it.
    .gte("created_at", chileDayBoundsUtc(dateStrOffset(todayStr, -30)).startUtc)
    .lt("created_at", todayBounds.endUtc);
  topServicesQuery = withTenant(topServicesQuery);
  const { data: txWithItems } = await topServicesQuery;

  const serviceMap: Record<string, number> = {};
  for (const tx of txWithItems || []) {
    for (const item of (tx as any).items || []) {
      if (!item.service_id) continue;
      serviceMap[item.description] = (serviceMap[item.description] || 0) + (item.quantity || 1);
    }
  }
  const topServices = Object.entries(serviceMap)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Weekly sales (7 days ending on the selected day, not always the real "today")
  const dayNames = ["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"];
  const weekData: Array<{ day: string; date: string; total: number }> = [];
  for (let i = 6; i >= 0; i--) {
    const dayStr = dateStrOffset(todayStr, -i);
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
    // Punto 8: el dia efectivamente usado para calcular todo lo anterior — el frontend
    // lo necesita para saber si "hoy" mostrado corresponde al que el usuario eligio o si
    // se cayo de vuelta al actual (fecha invalida/ausente).
    date: todayStr,
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
