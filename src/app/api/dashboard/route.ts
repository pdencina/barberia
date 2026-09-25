import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, getCurrentTenantId, resolveTenantForRequest, isManagerLevel } from "@/lib/supabase/server";
import { todayInChile, chileDayBoundsUtc, dateStrOffset } from "@/lib/utils";

const CHART_RANGES = ["7d", "1m", "3m", "12m"] as const;
type ChartRange = (typeof CHART_RANGES)[number];

interface ChartBucket {
  label: string;
  date: string; // bucket start (YYYY-MM-DD)
  endDate: string; // bucket end, exclusive (YYYY-MM-DD)
  startUtc: string;
  endUtcExclusive: string;
}

// Punto 9 (Pablo): el grafico de ventas ahora soporta 4 ventanas de tiempo para poder
// ver el crecimiento del negocio, no solo la ultima semana. Genera los "baldes" (dia,
// semana o mes segun el rango) terminando siempre en `todayStr` (el dia elegido en el
// selector de fecha del Dashboard), asi el grafico siempre respeta ese contexto.
function buildChartBuckets(todayStr: string, range: ChartRange): ChartBucket[] {
  const dayLabelsEs = ["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"];
  const monthLabelsEs = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  const dayStartUtc = (d: string) => chileDayBoundsUtc(d).startUtc;

  if (range === "1m") {
    // 30 baldes diarios
    return Array.from({ length: 30 }, (_, idx) => {
      const i = 29 - idx;
      const d = dateStrOffset(todayStr, -i);
      const next = dateStrOffset(d, 1);
      return { label: String(Number(d.slice(8, 10))), date: d, endDate: next, startUtc: dayStartUtc(d), endUtcExclusive: dayStartUtc(next) };
    });
  }

  if (range === "3m") {
    // 12 baldes semanales (7 dias c/u), el ultimo termina en todayStr
    return Array.from({ length: 12 }, (_, idx) => {
      const i = 11 - idx;
      const end = dateStrOffset(todayStr, -7 * i);
      const start = dateStrOffset(end, -6);
      const next = dateStrOffset(end, 1);
      const label = `${String(Number(start.slice(8, 10)))}/${String(Number(start.slice(5, 7)))}`;
      return { label, date: start, endDate: next, startUtc: dayStartUtc(start), endUtcExclusive: dayStartUtc(next) };
    });
  }

  if (range === "12m") {
    // 12 baldes mensuales (mes calendario), el ultimo es el mes de todayStr
    const [y, m] = todayStr.split("-").map(Number);
    return Array.from({ length: 12 }, (_, idx) => {
      const i = 11 - idx;
      let month = m - i;
      let year = y;
      while (month <= 0) {
        month += 12;
        year -= 1;
      }
      let nextMonth = month + 1;
      let nextYear = year;
      if (nextMonth > 12) {
        nextMonth = 1;
        nextYear += 1;
      }
      const start = `${year}-${String(month).padStart(2, "0")}-01`;
      const next = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;
      return { label: monthLabelsEs[month - 1], date: start, endDate: next, startUtc: dayStartUtc(start), endUtcExclusive: dayStartUtc(next) };
    });
  }

  // "7d" (default): 7 baldes diarios
  return Array.from({ length: 7 }, (_, idx) => {
    const i = 6 - idx;
    const d = dateStrOffset(todayStr, -i);
    const next = dateStrOffset(d, 1);
    const weekday = new Date(`${d}T12:00:00Z`).getUTCDay();
    return { label: dayLabelsEs[weekday], date: d, endDate: next, startUtc: dayStartUtc(d), endUtcExclusive: dayStartUtc(next) };
  });
}

function daysBetween(a: string, b: string): number {
  return Math.round((new Date(`${b}T12:00:00Z`).getTime() - new Date(`${a}T12:00:00Z`).getTime()) / 86400000);
}

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
  // Punto (Nico, 25-sep): mismo query tambien alimenta "Productos mas vendidos" — cada
  // item de una transaccion es o un service_id o un product_id (nunca ambos), asi que se
  // separan en dos mapas de conteo dentro de la misma pasada.
  let topServicesQuery = supabase
    .from("transactions")
    .select("items:transaction_items(description, quantity, service_id, product_id)")
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
  const productSalesMap: Record<string, number> = {};
  for (const tx of txWithItems || []) {
    for (const item of (tx as any).items || []) {
      if (item.service_id) {
        serviceMap[item.description] = (serviceMap[item.description] || 0) + (item.quantity || 1);
      } else if (item.product_id) {
        productSalesMap[item.description] = (productSalesMap[item.description] || 0) + (item.quantity || 1);
      }
    }
  }
  const topServices = Object.entries(serviceMap)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  const topProducts = Object.entries(productSalesMap)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 9);

  // Punto (Nico, 25-sep): aviso de stock bajo para el Dashboard — productos con
  // stock <= min_stock, los mas criticos primero (mayor deficit = stock - min_stock mas
  // negativo). Se trae el catalogo activo del negocio y se filtra/ordena en memoria: el
  // cliente de Supabase no permite comparar dos columnas entre si en un filtro .lte().
  let productsForStockQuery = supabase
    .from("products")
    .select("id, name, stock, min_stock")
    .eq("active", true);
  productsForStockQuery = withTenant(productsForStockQuery);
  const { data: allActiveProducts } = await productsForStockQuery;
  const lowStock = (allActiveProducts || [])
    .filter((p: any) => Number(p.stock) <= Number(p.min_stock))
    .sort((a: any, b: any) => (Number(a.stock) - Number(a.min_stock)) - (Number(b.stock) - Number(b.min_stock)))
    .slice(0, 9)
    .map((p: any) => ({ id: p.id, name: p.name, stock: Number(p.stock), minStock: Number(p.min_stock) }));

  // Calculate percentage changes
  const calcChange = (today: number, yesterday: number): number => {
    if (yesterday === 0) return today > 0 ? 100 : 0;
    return Math.round(((today - yesterday) / yesterday) * 100);
  };

  // Punto 9 (Pablo): grafico de ventas con 4 ventanas (7 dias / 1 mes / 3 meses / 12
  // meses) para ver el crecimiento del negocio de forma comoda, en vez de siempre la
  // ultima semana. Todo el rango se trae en UNA sola consulta y se agrupa en memoria
  // por balde (en vez de una consulta por dia), para que 12 meses no dispare ~365
  // queries secuenciales.
  const requestedRange = searchParams.get("range");
  const chartRange: ChartRange = (CHART_RANGES as readonly string[]).includes(requestedRange || "")
    ? (requestedRange as ChartRange)
    : "7d";
  const chartBuckets = buildChartBuckets(todayStr, chartRange);
  const chartRangeStartUtc = chartBuckets[0].startUtc;
  const chartRangeEndUtc = chartBuckets[chartBuckets.length - 1].endUtcExclusive;

  let chartTxQuery = supabase
    .from("transactions")
    .select("total, created_at")
    .eq("type", "income")
    .eq("status", "completed")
    .gte("created_at", chartRangeStartUtc)
    .lt("created_at", chartRangeEndUtc);
  chartTxQuery = withTenant(chartTxQuery);
  const { data: chartTxRaw } = await chartTxQuery;

  const chartData = chartBuckets.map((b) => {
    const total = (chartTxRaw || [])
      .filter((t: any) => t.created_at >= b.startUtc && t.created_at < b.endUtcExclusive)
      .reduce((sum: number, t: any) => sum + Number(t.total), 0);
    return { label: b.label, date: b.date, total };
  });
  const chartTotal = chartData.reduce((s, d) => s + d.total, 0);

  // Crecimiento: total del rango elegido vs el mismo largo de dias inmediatamente
  // anterior (ej. estos ultimos 30 dias vs los 30 dias previos a esos).
  const rangeSpanDays = daysBetween(chartBuckets[0].date, chartBuckets[chartBuckets.length - 1].endDate);
  const prevRangeStartDate = dateStrOffset(chartBuckets[0].date, -rangeSpanDays);
  const prevRangeStartUtc = chileDayBoundsUtc(prevRangeStartDate).startUtc;
  const prevRangeEndUtc = chartBuckets[0].startUtc;

  let prevChartTxQuery = supabase
    .from("transactions")
    .select("total")
    .eq("type", "income")
    .eq("status", "completed")
    .gte("created_at", prevRangeStartUtc)
    .lt("created_at", prevRangeEndUtc);
  prevChartTxQuery = withTenant(prevChartTxQuery);
  const { data: prevChartTx } = await prevChartTxQuery;
  const prevChartTotal = (prevChartTx || []).reduce((s: number, t: any) => s + Number(t.total), 0);
  const chartGrowth = calcChange(chartTotal, prevChartTotal);

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
    topProducts,
    lowStock,
    chartRange,
    chartData,
    chartTotal,
    chartGrowth,
  });
}
