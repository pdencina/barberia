import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, getCurrentTenantId, resolveTenantForRequest, isManagerLevel } from "@/lib/supabase/server";
import { todayInChile, chileDayBoundsUtc, dateStrOffset } from "@/lib/utils";
import { fetchAllRows } from "@/lib/accounting";
import { ventasPorMedio } from "@/lib/dashboard-format";
import { resumirCancelaciones } from "@/lib/cancel-reasons";

const CHART_RANGES = ["7d", "14d", "1m", "3m", "12m"] as const;
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
      return { label: (idx === 0 || d.slice(8, 10) === "01") ? `${Number(d.slice(8, 10))} ${monthLabelsEs[Number(d.slice(5, 7)) - 1].toLowerCase()}` : String(Number(d.slice(8, 10))), date: d, endDate: next, startUtc: dayStartUtc(d), endUtcExclusive: dayStartUtc(next) };
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

  // "7d" (default) y "14d": un balde por día
  const nDias = range === "14d" ? 14 : 7;
  return Array.from({ length: nDias }, (_, idx) => {
    const i = nDias - 1 - idx;
    const d = dateStrOffset(todayStr, -i);
    const next = dateStrOffset(d, 1);
    const weekday = new Date(`${d}T12:00:00Z`).getUTCDay();
    const label = nDias === 7 ? dayLabelsEs[weekday] : (idx === 0 || d.slice(8, 10) === "01") ? `${Number(d.slice(8, 10))} ${monthLabelsEs[Number(d.slice(5, 7)) - 1].toLowerCase()}` : String(Number(d.slice(8, 10)));
    return { label, date: d, endDate: next, startUtc: dayStartUtc(d), endUtcExclusive: dayStartUtc(next) };
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

  // Todas las consultas se lanzan juntas (antes eran ~17 seguidas, una tras otra).
  const countAppts = (date: string, statuses?: string[]) => {
    let q = supabase.from("appointments").select("id", { count: "exact", head: true }).eq("date", date);
    if (statuses) q = q.in("status", statuses);
    return withTenant(q);
  };
  const incomeIn = (startUtc: string, endUtc: string) =>
    withTenant(supabase
      .from("transactions")
      .select("total")
      .eq("type", "income")
      .eq("status", "completed")
      .gte("created_at", startUtc)
      .lt("created_at", endUtc));
  const newClientsIn = (startUtc: string, endUtc: string) =>
    withTenant(supabase
      .from("clients")
      .select("id", { count: "exact", head: true })
      .gte("created_at", startUtc)
      .lt("created_at", endUtc));

  // Punto 9 (Pablo): grafico de ventas con 4 ventanas (7 dias / 1 mes / 3 meses / 12
  // meses) para ver el crecimiento del negocio de forma comoda, en vez de siempre la
  // ultima semana. Todo el rango se trae en UNA sola consulta y se agrupa en memoria
  // por balde (en vez de una consulta por dia).
  const requestedRange = searchParams.get("range");
  const chartRange: ChartRange = (CHART_RANGES as readonly string[]).includes(requestedRange || "")
    ? (requestedRange as ChartRange)
    : "7d";
  const chartBuckets = buildChartBuckets(todayStr, chartRange);
  const chartRangeStartUtc = chartBuckets[0].startUtc;
  const chartRangeEndUtc = chartBuckets[chartBuckets.length - 1].endUtcExclusive;

  // Crecimiento: total del rango elegido vs el mismo largo de dias inmediatamente
  // anterior (ej. estos ultimos 30 dias vs los 30 dias previos a esos).
  const rangeSpanDays = daysBetween(chartBuckets[0].date, chartBuckets[chartBuckets.length - 1].endDate);
  const prevRangeStartDate = chartRange === "12m" ? `${Number(chartBuckets[0].date.slice(0, 4)) - 1}${chartBuckets[0].date.slice(4)}` : dateStrOffset(chartBuckets[0].date, -rangeSpanDays);
  const prevRangeStartUtc = chileDayBoundsUtc(prevRangeStartDate).startUtc;
  const prevRangeEndUtc = chartBuckets[0].startUtc;

  // Top servicios (ultimos 30 dias). transaction_items no tiene created_at: se filtra por
  // la transaccion padre (que si tiene created_at y tenant_id) y se recorren los items en
  // memoria. El mismo query alimenta "Productos mas vendidos" (cada item es o un
  // service_id o un product_id, nunca ambos). La ventana termina en el dia elegido.
  const topServicesQuery = withTenant(supabase
    .from("transactions")
    .select("items:transaction_items(description, quantity, service_id, product_id)")
    .eq("type", "income")
    .eq("status", "completed")
    .gte("created_at", chileDayBoundsUtc(dateStrOffset(todayStr, -30)).startUtc)
    .lt("created_at", todayBounds.endUtc));

  // Aviso de stock bajo: se trae el catalogo activo y se filtra en memoria (el cliente
  // de Supabase no puede comparar dos columnas entre si en un filtro).
  const productsForStockQuery = withTenant(supabase
    .from("products")
    .select("id, name, stock, min_stock")
    .eq("active", true));

  const todayAppointmentsQuery = withTenant(supabase
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

  // Proyeccion del dia: lo que falta por cobrar de las citas que aun no se completan (agendadas, confirmadas o en curso).
  // Las completadas ya estan en las ventas, asi que no se cuentan dos veces.
  const pendingApptsQuery = withTenant(supabase
    .from("appointments")
    .select("id, services:appointment_services(price)")
    .eq("date", todayStr)
    .in("status", ["scheduled", "confirmed", "in_progress"]));

  // Todas las filas del rango (con paginación: más de 1.000 ventas en 3 o 12 meses se cortaban y el gráfico quedaba corto).
  const chartTxP = fetchAllRows<any>(() => withTenant(supabase
    .from("transactions")
    .select("id, total, created_at, barber_id, payment_method")
    .eq("type", "income")
    .eq("status", "completed")
    .gte("created_at", chartRangeStartUtc)
    .lt("created_at", chartRangeEndUtc))).catch(() => [] as any[]).then((data) => ({ data }));
  const prevChartP = fetchAllRows<any>(() => withTenant(supabase
    .from("transactions")
    .select("id, total, created_at")
    .eq("type", "income")
    .eq("status", "completed")
    .gte("created_at", prevRangeStartUtc)
    .lt("created_at", prevRangeEndUtc))).catch(() => [] as any[]).then((data) => ({ data }));
  const barbersP = withTenant(supabase.from("profiles").select("id, name, role"));

  // Detalle de las cancelaciones del día: quién y por qué (migración 136; sin ella solo se cuenta cuántas).
  const cancelP = (async () => {
    const q = (cols: string) => withTenant(supabase.from("appointments").select(cols).eq("date", todayStr).in("status", ["cancelled", "no_show"]));
    let r: { data: any; error: any } = await q("status, cancelled_by, cancel_reason");
    if (r.error) r = await q("status");
    return (r.data || []) as any[];
  })().catch(() => [] as any[]);

  const [
    { count: todayApptCount },
    { count: yesterdayApptCount },
    { data: todayTx },
    { data: yesterdayTx },
    { count: newClientsToday },
    { count: newClientsYesterday },
    { count: rescheduledToday },
    { count: rescheduledYesterday },
    { count: cancelledToday },
    { count: cancelledYesterday },
    { data: todayAppointments },
    { data: txWithItems },
    { data: allActiveProducts },
    { data: chartTxRaw },
    { data: prevChartTx },
    { data: pendingAppts },
    { data: barberRows },
    cancelRows,
  ] = await Promise.all([
    countAppts(todayStr),
    countAppts(yesterdayStr),
    incomeIn(todayBounds.startUtc, todayBounds.endUtc),
    incomeIn(yesterdayBounds.startUtc, yesterdayBounds.endUtc),
    newClientsIn(todayBounds.startUtc, todayBounds.endUtc),
    newClientsIn(yesterdayBounds.startUtc, yesterdayBounds.endUtc),
    countAppts(todayStr, ["confirmed"]),
    countAppts(yesterdayStr, ["confirmed"]),
    countAppts(todayStr, ["cancelled", "no_show"]),
    countAppts(yesterdayStr, ["cancelled", "no_show"]),
    todayAppointmentsQuery,
    topServicesQuery,
    productsForStockQuery,
    chartTxP,
    prevChartP,
    pendingApptsQuery,
    barbersP,
    cancelP,
  ]);

  const todayIncome = (todayTx || []).reduce((s: number, t: any) => s + Number(t.total), 0);
  const pendingIncome = (pendingAppts || []).reduce(
    (sum: number, a: any) => sum + (a.services || []).reduce((s: number, x: any) => s + Number(x.price || 0), 0),
    0
  );
  const yesterdayIncome = (yesterdayTx || []).reduce((s: number, t: any) => s + Number(t.total), 0);

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

  const lowStock = (allActiveProducts || [])
    .filter((p: any) => Number(p.stock) <= Number(p.min_stock))
    .sort((a: any, b: any) => (Number(a.stock) - Number(a.min_stock)) - (Number(b.stock) - Number(b.min_stock)))
    .slice(0, 9)
    .map((p: any) => ({ id: p.id, name: p.name, stock: Number(p.stock), minStock: Number(p.min_stock) }));

  const calcChange = (today: number, yesterday: number): number => {
    if (yesterday === 0) return today > 0 ? 100 : 0;
    return Math.round(((today - yesterday) / yesterday) * 100);
  };

  // Mismo balde del período anterior (para la línea punteada de comparación): corrido los mismos días hacia atrás;
  // en «12 meses», el mismo mes del año anterior.
  const shiftBack = (d: string) => {
    if (chartRange === "12m") return `${Number(d.slice(0, 4)) - 1}${d.slice(4)}`;
    return dateStrOffset(d, -rangeSpanDays);
  };
  const inBucket = (rows: any[] | null, a: string, b: string) => (rows || []).filter((t: any) => t.created_at >= a && t.created_at < b);
  const chartData = chartBuckets.map((b) => {
    const total = inBucket(chartTxRaw, b.startUtc, b.endUtcExclusive).reduce((sum: number, t: any) => sum + Number(t.total), 0);
    const prev = inBucket(prevChartTx, chileDayBoundsUtc(shiftBack(b.date)).startUtc, chileDayBoundsUtc(shiftBack(b.endDate)).startUtc)
      .reduce((sum: number, t: any) => sum + Number(t.total), 0);
    return { label: b.label, date: b.date, total, prev };
  });
  const chartTotal = chartData.reduce((s, d) => s + d.total, 0);
  const prevChartTotal = (prevChartTx || []).reduce((s: number, t: any) => s + Number(t.total), 0);
  const chartGrowth = calcChange(chartTotal, prevChartTotal);

  // Ventas del período por profesional y por medio de pago (gráficos del Dashboard).
  const nombreDe = new Map<string, string>((barberRows || []).map((b: any) => [b.id, b.name]));
  const esRecepcion = new Set<string>((barberRows || []).filter((b: any) => b.role === "receptionist").map((b: any) => b.id));
  const porBarbero = new Map<string, { total: number; ventas: number }>();
  let sinProfesional = { total: 0, ventas: 0 };
  for (const t of chartTxRaw || []) {
    // Ventas hechas por recepción (o sin profesional) no son de ningún profesional: van aparte para que todo sume 100 %.
    if (!t.barber_id || esRecepcion.has(t.barber_id)) { sinProfesional = { total: sinProfesional.total + (Number(t.total) || 0), ventas: sinProfesional.ventas + 1 }; continue; }
    const c = porBarbero.get(t.barber_id) || { total: 0, ventas: 0 };
    c.total += Number(t.total) || 0; c.ventas += 1; porBarbero.set(t.barber_id, c);
  }
  const ventasPorProfesional = [
    ...Array.from(porBarbero.entries()).map(([id, c]) => ({ id, name: nombreDe.get(id) || "Profesional", total: c.total, ventas: c.ventas })).sort((a, b) => b.total - a.total).slice(0, 12),
    ...(sinProfesional.total > 0 ? [{ id: "sin-profesional", name: "Recepción / sin profesional", total: sinProfesional.total, ventas: sinProfesional.ventas }] : []),
  ];
  let medios: { medio: string; nombre: string; total: number }[] = [];
  try {
    const mixtos = (chartTxRaw || []).filter((t: any) => t.payment_method === "mixed").map((t: any) => t.id);
    const trozos: string[][] = [];
    for (let i = 0; i < mixtos.length; i += 200) trozos.push(mixtos.slice(i, i + 200));
    const partes: any[] = (await Promise.all(trozos.map((c) =>
      supabase.from("transaction_payments").select("transaction_id, payment_method, amount").in("transaction_id", c).then((r: any) => r.data || [])
    ))).flat();
    medios = ventasPorMedio(chartTxRaw || [], partes);
  } catch { /* sin desglose: el resto del Dashboard sigue igual */ }

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
      ventasPendientes: pendingIncome,
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
    ventasPorProfesional,
    ventasPorMedio: medios,
    cancelDetalle: resumirCancelaciones(cancelRows),
  });
}
