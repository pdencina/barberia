// Acceso a datos de las solicitudes de vacaciones (migracion 171). Todo con llave de servicio: cada llamada filtra por negocio.
import type { createAdminSupabase } from "@/lib/supabase/server";
import { diasQueTrabaja, saldoDe, type ModoReinicio, type Rango, type Saldo } from "@/lib/vacation-rules";
import { dateStrOffset, todayInChile } from "@/lib/utils";

type Admin = ReturnType<typeof createAdminSupabase>;
export interface PrefsVacaciones { diasPorAnio: number | null; modo: ModoReinicio }
export const faltaMigracion = (e: any) => !!e && /does not exist|schema cache|column/i.test(String(e.message || ""));

export async function cargarPrefs(supabase: Admin, tenantId: string): Promise<{ prefs: PrefsVacaciones; migracionFalta: boolean }> {
  const { data, error } = await supabase.from("tenants").select("vacation_days_per_year, vacation_reset_mode").eq("id", tenantId).maybeSingle();
  if (error) return { prefs: { diasPorAnio: null, modo: "calendar" }, migracionFalta: faltaMigracion(error) };
  const n = Number((data as any)?.vacation_days_per_year);
  return { prefs: { diasPorAnio: Number.isInteger(n) && n >= 1 ? n : null, modo: (data as any)?.vacation_reset_mode === "anniversary" ? "anniversary" : "calendar" }, migracionFalta: false };
}

// Fecha de ingreso: la que puso el administrador o, si no, el dia en que se creo el perfil.
export async function cargarProfesional(supabase: Admin, tenantId: string, barberId: string) {
  let r: any = await supabase.from("profiles").select("id, name, created_at, vacation_start_date").eq("id", barberId).eq("tenant_id", tenantId).maybeSingle();
  if (r.error) r = await supabase.from("profiles").select("id, name, created_at").eq("id", barberId).eq("tenant_id", tenantId).maybeSingle();
  if (!r.data) return null;
  const ingreso: string | null = r.data.vacation_start_date || (r.data.created_at ? String(r.data.created_at).slice(0, 10) : null);
  return { id: r.data.id as string, name: r.data.name as string, ingreso, ingresoManual: !!r.data.vacation_start_date };
}

export async function cargarHorario(supabase: Admin, barberId: string): Promise<boolean[]> {
  const { data } = await supabase.from("barber_schedule").select("day_of_week, is_working").eq("barber_id", barberId);
  return diasQueTrabaja((data as any[]) || []);
}

// Vacaciones ya registradas (aprobadas o puestas por el administrador) y solicitudes pendientes de un profesional.
export async function cargarOcupados(supabase: Admin, barberId: string, excluirSolicitud?: string): Promise<{ aprobadas: Rango[]; pendientes: Rango[] }> {
  const desde = dateStrOffset(todayInChile(), -800);
  const [v, s] = await Promise.all([
    supabase.from("professional_vacations").select("start_date, end_date").eq("barber_id", barberId).gte("end_date", desde),
    supabase.from("vacation_requests").select("id, start_date, end_date").eq("barber_id", barberId).eq("status", "pending").gte("end_date", desde),
  ]);
  return {
    aprobadas: ((v.data as any[]) || []).map((x) => ({ start_date: x.start_date, end_date: x.end_date })),
    pendientes: ((s.data as any[]) || []).filter((x) => x.id !== excluirSolicitud).map((x) => ({ start_date: x.start_date, end_date: x.end_date })),
  };
}

export function saldoActual(o: { prefs: PrefsVacaciones; ingreso: string | null; trabaja: boolean[]; rangos: Rango[]; hoy?: string }): Saldo {
  return saldoDe({ fecha: o.hoy || todayInChile(), diasAnio: o.prefs.diasPorAnio || 0, modo: o.prefs.modo, ingreso: o.ingreso, trabaja: o.trabaja, rangos: o.rangos });
}
