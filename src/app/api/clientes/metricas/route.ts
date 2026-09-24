import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, isManagerLevel } from "@/lib/supabase/server";
import { getTenantFromRequest } from "@/lib/tenant-filter";
import { todayInChile } from "@/lib/utils";

// Punto 10 (Pablo): "Metricas" en Clientes — diferenciar el origen de los clientes
// (reserva por link / agendado manualmente / desde promociones) para remarketing,
// seguimiento y reseñas. Visible solo para Administrador y Recepcion.

const SOURCE_LABELS: Record<string, string> = {
  link: "Reserva por link",
  manual: "Agendado manualmente",
  promotion: "Desde promociones",
  unknown: "Sin registrar",
};

export async function GET(req: NextRequest) {
  const { ok } = await isManagerLevel();
  if (!ok) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const supabase = createAdminSupabase();
  const tenantId = await getTenantFromRequest(req);
  const tf = (q: any) => (tenantId && tenantId !== "ALL") ? q.eq("tenant_id", tenantId) : q;

  // El origen de un CLIENTE se define por el origen de su primera cita registrada.
  // Se trae toda su historia de citas (con cliente asociado) para quedarnos con la mas
  // antigua por client_id; el volumen de una barberia individual es chico, no amerita
  // una consulta agregada mas compleja.
  const { data: appts } = await tf(supabase
    .from("appointments")
    .select("client_id, date, start_time, source")
    .not("client_id", "is", null)
    .order("date", { ascending: true })
    .order("start_time", { ascending: true }));

  // Primera cita por cliente (la lista ya viene ordenada de mas antigua a mas nueva).
  const firstApptByClient: Record<string, { date: string; source: string | null }> = {};
  for (const a of appts || []) {
    if (!a.client_id || firstApptByClient[a.client_id]) continue;
    firstApptByClient[a.client_id] = { date: a.date, source: a.source };
  }

  const clientIds = Object.keys(firstApptByClient);
  let clients: Array<{ id: string; name: string; email: string | null; phone: string | null }> = [];
  if (clientIds.length > 0) {
    const { data } = await supabase
      .from("clients")
      .select("id, name, email, phone")
      .in("id", clientIds);
    clients = data || [];
  }
  const clientById = Object.fromEntries(clients.map((c) => [c.id, c]));

  // Agrupa clientes por origen.
  const bySource: Record<string, Array<{ id: string; name: string; email: string | null; phone: string | null; firstVisit: string }>> = {
    link: [], manual: [], promotion: [], unknown: [],
  };
  for (const [clientId, info] of Object.entries(firstApptByClient)) {
    const client = clientById[clientId];
    if (!client) continue;
    const key = info.source && bySource[info.source] ? info.source : "unknown";
    bySource[key].push({ id: client.id, name: client.name, email: client.email, phone: client.phone, firstVisit: info.date });
  }
  for (const key of Object.keys(bySource)) {
    bySource[key].sort((a, b) => (a.firstVisit < b.firstVisit ? 1 : -1)); // mas recientes primero
  }

  const total = clientIds.length;
  const summary = Object.entries(bySource).map(([source, list]) => ({
    source,
    label: SOURCE_LABELS[source],
    count: list.length,
    percent: total > 0 ? Math.round((list.length / total) * 1000) / 10 : 0,
  }));

  // Tendencia: nuevos clientes por mes (ultimos 6 meses), desglosados por origen — para
  // ver si un cambio (ej. una campaña) esta moviendo el canal de captacion.
  const monthly: Array<{ label: string; link: number; manual: number; promotion: number; unknown: number }> = [];
  const monthNamesShort = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  const [chileYear, chileMonth1] = todayInChile().split("-").map(Number);
  const chileMonth = chileMonth1 - 1; // 0-indexed, to match getUTCMonth()
  for (let i = 5; i >= 0; i--) {
    // Resta i meses en aritmetica entera de mes/año (no dias), asi cada bucket cae en
    // un mes calendario distinto sin importar cuantos dias tenga cada mes.
    let m = chileMonth - i;
    let y = chileYear;
    while (m < 0) { m += 12; y--; }
    const label = `${monthNamesShort[m]} ${String(y).slice(2)}`;
    const bucket = { label, link: 0, manual: 0, promotion: 0, unknown: 0 };
    for (const info of Object.values(firstApptByClient)) {
      const ad = new Date(`${info.date}T12:00:00Z`);
      if (ad.getUTCFullYear() === y && ad.getUTCMonth() === m) {
        const key = info.source && bucket.hasOwnProperty(info.source) ? info.source : "unknown";
        (bucket as any)[key]++;
      }
    }
    monthly.push(bucket);
  }

  return NextResponse.json({
    summary,
    monthly,
    clientsBySource: bySource,
  });
}
