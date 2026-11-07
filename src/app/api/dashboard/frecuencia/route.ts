import { NextResponse } from "next/server";
import { createAdminSupabase, requireRole, resolveTenantForRequest } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/accounting";
import { dateStrOffset, todayInChile } from "@/lib/utils";
import { calcularFrecuencia, promedioHastaDia, mesAnteriorDe, diasDelMes } from "@/lib/frecuencia";

export const dynamic = "force-dynamic";

// Frecuencia de visita (veces al mes que viene en promedio cada cliente) de todo el negocio. Solo administrador; el negocio sale de la sesión.
export async function GET(req: Request) {
  const guard = await requireRole(["admin", "super_admin"]);
  if (!guard.ok) return guard.response;
  const { tenantId } = await resolveTenantForRequest(new URL(req.url).searchParams.get("tenantId"));
  if (!tenantId || tenantId === "ALL") return NextResponse.json({ meses: [] });

  const sb = createAdminSupabase();
  const hoy = todayInChile();
  // ?fecha= (el día que se mira en el Dashboard): el mes se evalúa hasta ese día. Sin fecha o con una futura, hoy.
  const pedida = new URL(req.url).searchParams.get("fecha") || "";
  const fecha = /^\d{4}-\d{2}-\d{2}$/.test(pedida) && pedida <= hoy ? pedida : hoy;
  const mes = fecha.slice(0, 7), dia = Number(fecha.slice(8, 10));
  const parcial = dia < diasDelMes(mes);
  try {
    const citas = await fetchAllRows<any>(() => sb.from("appointments").select("id, client_id, date")
      .eq("tenant_id", tenantId).eq("status", "completed").not("client_id", "is", null)
      .gte("date", dateStrOffset(fecha, -400)).lte("date", fecha));
    const meses = calcularFrecuencia(citas, parcial ? mes : "");
    // Mes en curso: se compara con el mes anterior hasta el mismo día (un mes completo siempre le ganaría a uno a medias).
    const ant = mesAnteriorDe(mes);
    const comparable = meses.length > 0 ? { mes: ant, hastaDia: Math.min(dia, diasDelMes(ant)), ...promedioHastaDia(citas, ant, dia) } : null;
    return NextResponse.json({ meses, comparable, parcial });
  } catch {
    return NextResponse.json({ meses: [], comparable: null });
  }
}
