import { NextResponse } from "next/server";
import { createAdminSupabase, requireRole, resolveTenantForRequest } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/accounting";
import { dateStrOffset, todayInChile } from "@/lib/utils";
import { calcularOcupacion, evaluarCierre, type ProOc } from "@/lib/ocupacion";

export const dynamic = "force-dynamic";

const MIN_VISITAS_MES_REAL = 50; // igual que «Visitas por cliente»: antes de eso el equipo no cerraba las ventas como ahora
const fechaChile = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago" }).format(new Date(iso));
const trozos = <T,>(a: T[], n: number) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));

// Ocupación de todos los profesionales del negocio (horas disponibles vs horas con cita), mes a mes. Solo administrador.
export async function GET(req: Request) {
  const guard = await requireRole(["admin", "super_admin"]);
  if (!guard.ok) return guard.response;
  const { tenantId } = await resolveTenantForRequest(new URL(req.url).searchParams.get("tenantId"));
  if (!tenantId || tenantId === "ALL") return NextResponse.json({ meses: [], pros: [], horas: {} });

  const sb = createAdminSupabase();
  const hoy = todayInChile();
  const ayer = dateStrOffset(hoy, -1);                       // el día de hoy aún no termina: no se mide
  const desdeBusqueda = dateStrOffset(hoy, -200);
  try {
    // Profesionales activos que atienden y tienen horario
    const { data: perfiles } = await sb.from("profiles").select("id, name, role, active, work_mode, also_attends_clients").eq("tenant_id", tenantId).eq("active", true).in("role", ["barber", "admin"]);
    const candidatos = (perfiles || []).filter((p: any) => p.role === "barber" || p.also_attends_clients !== false);
    const ids = candidatos.map((p: any) => p.id);
    if (ids.length === 0) return NextResponse.json({ meses: [], pros: [], horas: {} });

    const [horarios, descansos, vacaciones] = await Promise.all([
      sb.from("barber_schedule").select("barber_id, day_of_week, is_working, start_time, end_time, break_start, break_end").in("barber_id", ids).then((r: any) => r.data || []),
      sb.from("barber_breaks").select("barber_id, day_of_week, start_time, end_time").in("barber_id", ids).then((r: any) => (r.error ? [] : r.data || [])),
      sb.from("professional_vacations").select("barber_id, start_date, end_date").eq("tenant_id", tenantId).then((r: any) => (r.error ? [] : r.data || [])),
    ]);
    const conHorario = new Set((horarios as any[]).filter((h) => h.is_working).map((h) => h.barber_id));
    const pros: ProOc[] = candidatos.filter((p: any) => conHorario.has(p.id)).map((p: any) => ({ id: p.id, name: String(p.name || "").trim(), modo: p.work_mode === "rental" ? "arriendo" : "comision" }));

    const citas = await fetchAllRows<any>(() => sb.from("appointments").select("id, barber_id, date, start_time, end_time")
      .eq("tenant_id", tenantId).eq("status", "completed").gte("date", desdeBusqueda).lte("date", ayer));
    // Primer mes con flujo real
    const porMes = new Map<string, number>();
    for (const c of citas) porMes.set(String(c.date).slice(0, 7), (porMes.get(String(c.date).slice(0, 7)) || 0) + 1);
    const primero = Array.from(porMes.entries()).sort((a, b) => a[0].localeCompare(b[0])).find(([, n]) => n >= MIN_VISITAS_MES_REAL)?.[0];
    if (!primero) return NextResponse.json({ meses: [], pros, horas: {} });
    const desde = `${primero}-01`;

    const idsPros = pros.map((p) => p.id);
    const bloqueos = (await Promise.all(trozos(idsPros, 40).map((c) => sb.from("barber_blocks").select("barber_id, date, all_day, start_time, end_time").in("barber_id", c).gte("date", desde).lte("date", ayer).then((r: any) => (r.error ? [] : r.data || []))))).flat();
    const tx = await fetchAllRows<any>(() => sb.from("transactions").select("id, barber_id, total, created_at").eq("tenant_id", tenantId).eq("type", "income").eq("status", "completed").in("barber_id", idsPros).gte("created_at", `${dateStrOffset(desde, -1)}T00:00:00Z`));
    const ventas = tx.map((t: any) => ({ barber_id: t.barber_id, dia: fechaChile(t.created_at), total: Number(t.total) || 0 }));

    // ¿Se están cerrando las citas? (si no, la ocupación no es confiable)
    const estados = await fetchAllRows<any>(() => sb.from("appointments").select("id, status").eq("tenant_id", tenantId).gte("date", desde).lte("date", ayer));
    const cierre = evaluarCierre(estados.map((e: any) => e.status));

    const r = calcularOcupacion({ pros, horarios, descansos, bloqueos, vacaciones, citas: citas.filter((c: any) => c.date >= desde), ventas, desde, hasta: ayer });
    return NextResponse.json({ ...r, desde, hasta: ayer, mesEnCurso: hoy.slice(0, 7), cierre });
  } catch (e) {
    console.error("[ocupacion]", e);
    return NextResponse.json({ meses: [], pros: [], horas: {}, error: "No se pudo calcular" });
  }
}
