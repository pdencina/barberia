import { NextResponse } from "next/server";
import { createAdminSupabase, requireRole, resolveTenantForRequest } from "@/lib/supabase/server";
import { cargarCredencialAbono } from "@/lib/deposit";
import { todayInChile } from "@/lib/utils";
import { diagnosticar, resumenDiagnostico } from "@/lib/oti/diagnostico";

export const dynamic = "force-dynamic";

// «Mis clientes no pueden reservar»: Oti revisa el negocio de quien pregunta (solo administrador; el negocio sale de la sesion) y devuelve lo que encontro.
// Solo LEE: nunca cambia nada.
export async function GET() {
  const guard = await requireRole(["admin", "super_admin"]);
  if (!guard.ok) return guard.response;
  const { tenantId } = await resolveTenantForRequest(null);
  if (!tenantId || tenantId === "ALL") return NextResponse.json({ error: "Elige un negocio para revisarlo." }, { status: 400 });
  const sb = createAdminSupabase();

  const [t, aj, pr, ho, hn, sv, as, va] = await Promise.all([
    sb.from("tenants").select("status, trial_ends_at, slug, booking_window_days").eq("id", tenantId).maybeSingle(),
    sb.from("tenant_settings").select("booking_enabled, deposit_enabled").eq("tenant_id", tenantId).maybeSingle(),
    sb.from("profiles").select("id, name, role, active, also_attends_clients").eq("tenant_id", tenantId).in("role", ["barber", "admin"]),
    sb.from("barber_schedule").select("barber_id, day_of_week, is_working, profiles!inner(tenant_id)").eq("profiles.tenant_id", tenantId),
    sb.from("business_hours").select("day_of_week, is_closed").eq("tenant_id", tenantId),
    sb.from("services").select("id, name, active, internal_only").eq("tenant_id", tenantId),
    sb.from("barber_service_assignments").select("barber_id, service_id, profiles!inner(tenant_id)").eq("profiles.tenant_id", tenantId),
    sb.from("professional_vacations").select("barber_id, start_date, end_date").eq("tenant_id", tenantId).gte("end_date", todayInChile()),
  ]);
  let mp = false;
  try { mp = !!(await cargarCredencialAbono(sb, tenantId)).token; } catch { mp = false; }

  const hallazgos = diagnosticar({
    hoy: todayInChile(),
    tenant: { status: (t.data as any)?.status ?? null, trial_ends_at: (t.data as any)?.trial_ends_at ?? null, slug: (t.data as any)?.slug ?? null, booking_window_days: (t.data as any)?.booking_window_days ?? null },
    ajustes: { booking_enabled: (aj.data as any)?.booking_enabled ?? null, deposit_enabled: (aj.data as any)?.deposit_enabled ?? null, mpConfigurado: mp },
    profesionales: (pr.data as any[]) || [],
    horarios: (ho.data as any[]) || [],
    horarioNegocio: (hn.data as any[]) || [],
    servicios: (sv.data as any[]) || [],
    asignaciones: (as.data as any[]) || [],
    vacaciones: (va.data as any[]) || [],
  });
  return NextResponse.json({ hallazgos, texto: resumenDiagnostico(hallazgos) });
}
