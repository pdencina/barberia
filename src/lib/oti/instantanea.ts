// Carga una «instantanea» del negocio (solo lectura) con lo necesario para el diagnostico de reservas y para el checklist de configuracion inicial.
import { cargarCredencialAbono } from "@/lib/deposit";
import { todayInChile } from "@/lib/utils";
import type { InstantaneaNegocio } from "@/lib/oti/diagnostico";

export interface InstantaneaExtendida extends InstantaneaNegocio {
  datos: { name: string; logo_url: string | null; phone: string | null; address: string | null };
  horasPro: { barber_id: string; day_of_week: number; is_working: boolean | null; start_time: string | null; end_time: string | null }[];
  horasNegocio: { day_of_week: number; is_closed: boolean | null; open_time: string | null; close_time: string | null }[];
}

export async function cargarInstantanea(sb: any, tenantId: string): Promise<InstantaneaExtendida> {
  const [t, aj, pr, ho, hn, sv, as, va] = await Promise.all([
    sb.from("tenants").select("name, status, trial_ends_at, slug, booking_window_days, logo_url, phone, address").eq("id", tenantId).maybeSingle(),
    sb.from("tenant_settings").select("booking_enabled, deposit_enabled").eq("tenant_id", tenantId).maybeSingle(),
    sb.from("profiles").select("id, name, role, active, also_attends_clients").eq("tenant_id", tenantId).in("role", ["barber", "admin"]),
    sb.from("barber_schedule").select("barber_id, day_of_week, is_working, start_time, end_time, profiles!inner(tenant_id)").eq("profiles.tenant_id", tenantId),
    sb.from("business_hours").select("day_of_week, is_closed, open_time, close_time").eq("tenant_id", tenantId),
    sb.from("services").select("id, name, active, internal_only").eq("tenant_id", tenantId),
    sb.from("barber_service_assignments").select("barber_id, service_id, profiles!inner(tenant_id)").eq("profiles.tenant_id", tenantId),
    sb.from("professional_vacations").select("barber_id, start_date, end_date").eq("tenant_id", tenantId).gte("end_date", todayInChile()),
  ]);
  let mp = false;
  try { mp = !!(await cargarCredencialAbono(sb, tenantId)).token; } catch { mp = false; }
  const tt: any = t.data || {};
  const horasPro = ((ho.data as any[]) || []).map((h) => ({ barber_id: h.barber_id, day_of_week: h.day_of_week, is_working: h.is_working, start_time: h.start_time, end_time: h.end_time }));
  const horasNegocio = ((hn.data as any[]) || []).map((h) => ({ day_of_week: h.day_of_week, is_closed: h.is_closed, open_time: h.open_time, close_time: h.close_time }));
  return {
    hoy: todayInChile(),
    tenant: { status: tt.status ?? null, trial_ends_at: tt.trial_ends_at ?? null, slug: tt.slug ?? null, booking_window_days: tt.booking_window_days ?? null },
    ajustes: { booking_enabled: (aj.data as any)?.booking_enabled ?? null, deposit_enabled: (aj.data as any)?.deposit_enabled ?? null, mpConfigurado: mp },
    profesionales: (pr.data as any[]) || [],
    horarios: horasPro.map((h) => ({ barber_id: h.barber_id, day_of_week: h.day_of_week, is_working: h.is_working })),
    horarioNegocio: horasNegocio.map((h) => ({ day_of_week: h.day_of_week, is_closed: h.is_closed })),
    servicios: (sv.data as any[]) || [],
    asignaciones: (as.data as any[]) || [],
    vacaciones: (va.data as any[]) || [],
    datos: { name: tt.name ?? "", logo_url: tt.logo_url ?? null, phone: tt.phone ?? null, address: tt.address ?? null },
    horasPro, horasNegocio,
  };
}
