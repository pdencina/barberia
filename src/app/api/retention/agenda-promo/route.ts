import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, requireRole, resolveTenantForRequest } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/accounting";
import { dateStrOffset, todayInChile } from "@/lib/utils";
import { calcularOcupacion, pctOcup, totalGrupo, type ProOc } from "@/lib/ocupacion";
import { periodoPromo, recortarHorarios } from "@/lib/agenda-promo";

export const dynamic = "force-dynamic";

// Cómo está la agenda de cada profesional en los días (y horario) de una promoción. Solo informa. Administración.
export async function GET(req: NextRequest) {
  const guard = await requireRole(["admin", "super_admin", "receptionist"]);
  if (!guard.ok) return guard.response;
  const sp = new URL(req.url).searchParams;
  const { tenantId } = await resolveTenantForRequest(sp.get("tenantId"));
  if (!tenantId || tenantId === "ALL") return NextResponse.json({ error: "Elige un negocio" }, { status: 400 });

  const p = periodoPromo(sp.get("desde"), sp.get("hasta"), todayInChile(), dateStrOffset);
  if ("error" in p) return NextResponse.json({ error: p.error }, { status: 400 });

  const sb = createAdminSupabase();
  try {
    const { data: perfiles } = await sb.from("profiles").select("id, name, role, work_mode, also_attends_clients").eq("tenant_id", tenantId).eq("active", true).in("role", ["barber", "admin"]);
    const pros: ProOc[] = (perfiles || []).filter((x: any) => x.role === "barber" || x.also_attends_clients !== false)
      .map((x: any) => ({ id: x.id, name: String(x.name || "").trim(), modo: x.work_mode === "rental" ? "arriendo" : "comision" }));
    const ids = pros.map((x) => x.id);
    if (ids.length === 0) return NextResponse.json({ ...p, pros: [] });

    const filas = (r: any) => { if (r.error) throw r.error; return r.data || []; };
    const [horarios, descansos, vacaciones, bloqueos, citas] = await Promise.all([
      sb.from("barber_schedule").select("barber_id, day_of_week, is_working, start_time, end_time, break_start, break_end").in("barber_id", ids).then(filas),
      sb.from("barber_breaks").select("barber_id, day_of_week, start_time, end_time").in("barber_id", ids).then((r: any) => (r.error ? [] : r.data || [])),
      sb.from("professional_vacations").select("barber_id, start_date, end_date").eq("tenant_id", tenantId).then((r: any) => (r.error ? [] : r.data || [])),
      sb.from("barber_blocks").select("barber_id, date, all_day, start_time, end_time").in("barber_id", ids).gte("date", p.desde).lte("date", p.hasta).then((r: any) => (r.error ? [] : r.data || [])),
      fetchAllRows<any>(() => sb.from("appointments").select("id, barber_id, date, start_time, end_time").eq("tenant_id", tenantId).in("status", ["scheduled", "confirmed", "in_progress", "completed"]).gte("date", p.desde).lte("date", p.hasta)),
    ]);

    const r = calcularOcupacion({ pros, horarios: recortarHorarios(horarios as any, sp.get("horaDesde"), sp.get("horaHasta")), descansos, bloqueos, vacaciones, citas, ventas: [], desde: p.desde, hasta: p.hasta });
    const salida = r.pros.map((x) => {
      // Se suman los meses que toque el periodo.
      const t = r.meses.reduce((acc, m) => { const v = totalGrupo({ ...r, pros: [x] }, "todos", m); return { disp: acc.disp + v.disp, ocup: acc.ocup + v.ocup }; }, { disp: 0, ocup: 0 });
      return { id: x.id, name: x.name, disp: t.disp, ocup: t.ocup, pct: pctOcup(t.ocup, t.disp) };
    }).sort((a, b) => Number(a.disp === 0) - Number(b.disp === 0) || a.pct - b.pct || a.name.localeCompare(b.name, "es"));
    return NextResponse.json({ ...p, pros: salida });
  } catch (e) {
    console.error("[agenda-promo]", e);
    return NextResponse.json({ error: "No se pudo revisar la agenda" }, { status: 500 });
  }
}
