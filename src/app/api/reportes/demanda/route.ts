import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, getCallerForView } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/accounting";
import { dateStrOffset, todayInChile } from "@/lib/utils";
import { construirMapa } from "@/lib/demand-map";
import { disponibilidadPorDiaHora } from "@/lib/disponibilidad";

export const dynamic = "force-dynamic";

// Mapa de demanda del negocio (solo admin): reservas promedio por semana en cada dia y hora. Solo lectura.
// El negocio sale siempre de la sesion; un administrador no puede pedir el de otro.
export async function GET(req: NextRequest) {
  const c = await getCallerForView();
  if (!c.userId || (c.role !== "admin" && c.role !== "super_admin") || !c.tenantId || c.tenantId === "ALL") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  const sp = new URL(req.url).searchParams;
  const weeks = [4, 8, 12].includes(Number(sp.get("weeks"))) ? Number(sp.get("weeks")) : 8;
  const hasta = dateStrOffset(todayInChile(), -1); // semanas completas hacia atras, sin contar hoy
  const desde = dateStrOffset(hasta, -(weeks * 7) + 1);
  const barberId = sp.get("barberId");
  if (barberId && !/^[0-9a-f-]{36}$/i.test(barberId)) return NextResponse.json({ error: "Profesional no valido" }, { status: 400 });

  const supabase = createAdminSupabase();
  try {
    const rows = await fetchAllRows<any>(() => {
      let q = supabase.from("appointments").select("id, date, start_time, end_time, status").eq("tenant_id", c.tenantId!).gte("date", desde).lte("date", hasta);
      if (barberId) q = q.eq("barber_id", barberId);
      return q;
    });
    // El horario de cada negocio es distinto (días, horas, colaciones, bloqueos): se usa el del equipo para saber en qué horas SÍ se atiende.
    // Si no hay horarios cargados (o algo falla), el mapa se arma como antes, con el rango de cada día según las reservas.
    let disponibilidad: Record<string, number> | undefined;
    try {
      const { data: perfiles } = await supabase.from("profiles").select("id, role, also_attends_clients").eq("tenant_id", c.tenantId!).eq("active", true).in("role", ["barber", "admin"]);
      let ids = (perfiles || []).filter((p: any) => p.role === "barber" || p.also_attends_clients !== false).map((p: any) => p.id as string);
      if (barberId) ids = ids.filter((id) => id === barberId);
      if (ids.length) {
        const trozos = <T,>(a: T[], n: number) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));
        const [horarios, descansos, vacaciones, bloqueos] = await Promise.all([
          supabase.from("barber_schedule").select("barber_id, day_of_week, is_working, start_time, end_time, break_start, break_end").in("barber_id", ids).then((r: any) => r.data || []),
          supabase.from("barber_breaks").select("barber_id, day_of_week, start_time, end_time").in("barber_id", ids).then((r: any) => (r.error ? [] : r.data || [])),
          supabase.from("professional_vacations").select("barber_id, start_date, end_date").eq("tenant_id", c.tenantId!).then((r: any) => (r.error ? [] : r.data || [])),
          Promise.all(trozos(ids, 40).map((ch) => supabase.from("barber_blocks").select("barber_id, date, all_day, start_time, end_time").in("barber_id", ch).gte("date", desde).lte("date", hasta).then((r: any) => (r.error ? [] : r.data || [])))).then((x) => x.flat()),
        ]);
        const conHorario = Array.from(new Set((horarios as any[]).filter((h) => h.is_working).map((h) => h.barber_id as string)));
        if (conHorario.length) disponibilidad = disponibilidadPorDiaHora({ proIds: conHorario, horarios, descansos, bloqueos, vacaciones, desde, hasta });
      }
    } catch { disponibilidad = undefined; }
    return NextResponse.json(construirMapa(rows, weeks, desde, hasta, disponibilidad));
  } catch {
    return NextResponse.json({ error: "No se pudo calcular el mapa de demanda" }, { status: 500 });
  }
}
