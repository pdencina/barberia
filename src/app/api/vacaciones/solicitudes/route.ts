import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, getCallerForView } from "@/lib/supabase/server";
import { dateStrOffset, todayInChile } from "@/lib/utils";
import { notify } from "@/lib/notify";
import { cargarHorario, cargarOcupados, cargarPrefs, cargarProfesional, faltaMigracion, saldoActual } from "@/lib/vacation-requests";
import { diasQueTrabaja, validarSolicitud } from "@/lib/vacation-rules";

export const dynamic = "force-dynamic";

// Solicitudes de vacaciones (migracion 171). El profesional pide un bloque que empieza un lunes; el administrador lo acepta o lo rechaza.
// Al aceptar se crea la vacacion en professional_vacations (la agenda y la reserva online ya la respetan). El negocio sale SIEMPRE de la sesion.
const esAdmin = (role: string | null) => role === "admin" || role === "super_admin";
const fmt = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("es-CL", { timeZone: "UTC", day: "numeric", month: "short" });

export async function GET() {
  const c = await getCallerForView();
  if (!c.userId || !c.tenantId || c.tenantId === "ALL" || (c.role !== "barber" && !esAdmin(c.role))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const supabase = createAdminSupabase();
  const { prefs, migracionFalta } = await cargarPrefs(supabase, c.tenantId);
  const hoy = todayInChile();

  if (c.role === "barber") {
    const pro = await cargarProfesional(supabase, c.tenantId, c.userId);
    if (!pro) return NextResponse.json({ error: "Profesional no encontrado" }, { status: 404 });
    const [trabaja, ocupados, reqs] = await Promise.all([
      cargarHorario(supabase, pro.id),
      cargarOcupados(supabase, pro.id),
      supabase.from("vacation_requests").select("id, start_date, end_date, working_days, note, status, decision_note, created_at").eq("barber_id", pro.id).gte("end_date", dateStrOffset(hoy, -400)).order("start_date", { ascending: false }),
    ]);
    const saldo = saldoActual({ prefs, ingreso: pro.ingreso, trabaja, rangos: [...ocupados.aprobadas, ...ocupados.pendientes], hoy });
    return NextResponse.json({
      rol: "profesional", prefs, migracionFalta: migracionFalta || faltaMigracion(reqs.error), hoy,
      trabaja, saldo, ingreso: pro.ingreso,
      bloqueados: [...ocupados.aprobadas, ...ocupados.pendientes],
      solicitudes: reqs.data || [],
    });
  }

  // Administrador: solicitudes del negocio y saldo de cada profesional.
  let pr: any = await supabase.from("profiles").select("id, name, role, also_attends_clients, created_at, vacation_start_date").eq("tenant_id", c.tenantId).eq("active", true).in("role", ["barber", "admin"]);
  if (pr.error) pr = await supabase.from("profiles").select("id, name, role, also_attends_clients, created_at").eq("tenant_id", c.tenantId).eq("active", true).in("role", ["barber", "admin"]);
  const pros = ((pr.data as any[]) || []).filter((p) => p.role === "barber" || p.also_attends_clients);
  const ids = pros.map((p) => p.id);
  const desde = dateStrOffset(hoy, -800);
  const [horarios, vac, reqs] = await Promise.all([
    ids.length ? supabase.from("barber_schedule").select("barber_id, day_of_week, is_working").in("barber_id", ids) : Promise.resolve({ data: [] as any[] }),
    supabase.from("professional_vacations").select("barber_id, start_date, end_date").eq("tenant_id", c.tenantId).gte("end_date", desde),
    supabase.from("vacation_requests").select("id, barber_id, start_date, end_date, working_days, note, status, decision_note, decided_by_name, decided_at, created_at").eq("tenant_id", c.tenantId).gte("end_date", dateStrOffset(hoy, -400)).order("created_at", { ascending: false }),
  ]);
  const solicitudes = (reqs.data as any[]) || [];
  const saldos = pros.map((p) => {
    const trabaja = diasQueTrabaja(((horarios.data as any[]) || []).filter((h) => h.barber_id === p.id));
    const ingreso: string | null = p.vacation_start_date || (p.created_at ? String(p.created_at).slice(0, 10) : null);
    const rangos = [
      ...((vac.data as any[]) || []).filter((v) => v.barber_id === p.id),
      ...solicitudes.filter((s) => s.barber_id === p.id && s.status === "pending"),
    ];
    const saldo = saldoActual({ prefs, ingreso, trabaja, rangos, hoy });
    return { barberId: p.id as string, name: p.name as string, ingreso, ingresoManual: !!p.vacation_start_date, trabaja, bloqueados: rangos.map((r: any) => ({ start_date: r.start_date, end_date: r.end_date })), ...saldo };
  });
  return NextResponse.json({ rol: "admin", prefs, migracionFalta: migracionFalta || faltaMigracion(reqs.error), hoy, saldos, solicitudes });
}

export async function POST(req: NextRequest) {
  const c = await getCallerForView();
  if (!c.userId || !c.tenantId || c.tenantId === "ALL" || c.role !== "barber") return NextResponse.json({ error: "Solo los profesionales piden vacaciones desde aquí." }, { status: 403 });
  const body = await req.json().catch(() => ({} as any));
  const supabase = createAdminSupabase();
  const { prefs, migracionFalta } = await cargarPrefs(supabase, c.tenantId);
  if (migracionFalta) return NextResponse.json({ error: "Falta aplicar la migración 171 en la base de datos." }, { status: 409 });
  if (!prefs.diasPorAnio) return NextResponse.json({ error: "Tu administrador todavía no activó las solicitudes de vacaciones." }, { status: 409 });
  const pro = await cargarProfesional(supabase, c.tenantId, c.userId);
  if (!pro) return NextResponse.json({ error: "Profesional no encontrado" }, { status: 404 });

  const trabaja = await cargarHorario(supabase, pro.id);
  const ocupados = await cargarOcupados(supabase, pro.id);
  const v = validarSolicitud({ hoy: todayInChile(), inicio: body?.startDate, fin: body?.endDate, trabaja, diasAnio: prefs.diasPorAnio, modo: prefs.modo, ingreso: pro.ingreso, ocupados: [...ocupados.aprobadas, ...ocupados.pendientes] });
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });

  const note = String(body?.note || "").trim().slice(0, 200) || null;
  const { data, error } = await supabase.from("vacation_requests").insert({ tenant_id: c.tenantId, barber_id: pro.id, start_date: body.startDate, end_date: body.endDate, working_days: v.laborales, note }).select("id").single();
  if (error) return NextResponse.json({ error: "No se pudo enviar la solicitud." }, { status: 500 });

  await notify({
    tenantId: c.tenantId, kind: "vacation_request", roles: ["admin"], createdBy: c.userId, createdByName: pro.name,
    title: `${pro.name} pidió vacaciones`, body: `${fmt(body.startDate)} al ${fmt(body.endDate)} (${v.laborales} días laborales).`, url: "/dashboard/vacaciones",
  });
  return NextResponse.json({ success: true, id: data?.id, laborales: v.laborales });
}

// { id, action: "approve" | "reject" | "cancel", note? }. Aprobar y rechazar: administrador. Cancelar una pendiente: el propio profesional.
export async function PATCH(req: NextRequest) {
  const c = await getCallerForView();
  if (!c.userId || !c.tenantId || c.tenantId === "ALL") return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const body = await req.json().catch(() => ({} as any));
  const action = body?.action;
  if (typeof body?.id !== "string" || !["approve", "reject", "cancel"].includes(action)) return NextResponse.json({ error: "Solicitud no válida" }, { status: 400 });
  const supabase = createAdminSupabase();
  const { data: s } = await supabase.from("vacation_requests").select("*").eq("id", body.id).eq("tenant_id", c.tenantId).maybeSingle();
  if (!s) return NextResponse.json({ error: "Solicitud no encontrada" }, { status: 404 });
  if (s.status !== "pending") return NextResponse.json({ error: "Esa solicitud ya fue resuelta." }, { status: 409 });
  const ahora = new Date().toISOString();

  if (action === "cancel") {
    if (c.role !== "barber" || s.barber_id !== c.userId) return NextResponse.json({ error: "Solo quien la pidió puede cancelarla." }, { status: 403 });
    await supabase.from("vacation_requests").update({ status: "cancelled", updated_at: ahora }).eq("id", s.id).eq("status", "pending");
    return NextResponse.json({ success: true });
  }

  if (!esAdmin(c.role)) return NextResponse.json({ error: "Solo el administrador resuelve las solicitudes." }, { status: 403 });
  const { data: yo } = await supabase.from("profiles").select("name").eq("id", c.userId).maybeSingle();
  const decision = { decided_by: c.userId, decided_by_name: yo?.name || null, decided_at: ahora, updated_at: ahora, decision_note: String(body?.note || "").trim().slice(0, 200) || null };
  const nombre = (await cargarProfesional(supabase, c.tenantId, s.barber_id))?.name || "Profesional";
  const rango = `${fmt(s.start_date)} al ${fmt(s.end_date)}`;

  if (action === "reject") {
    const { data: up } = await supabase.from("vacation_requests").update({ ...decision, status: "rejected" }).eq("id", s.id).eq("status", "pending").select("id");
    if (!up || up.length === 0) return NextResponse.json({ error: "Esa solicitud ya fue resuelta." }, { status: 409 });
    await notify({ tenantId: c.tenantId, kind: "vacation_decision", userIds: [s.barber_id], createdBy: c.userId, createdByName: yo?.name, title: "Tus vacaciones no fueron aceptadas", body: `${rango}${decision.decision_note ? `: ${decision.decision_note}` : ""}`, url: "/dashboard/vacaciones" });
    return NextResponse.json({ success: true });
  }

  // Aprobar: se vuelve a validar (el administrador pudo cambiar los dias por año o el profesional otra solicitud) y se crea la vacacion.
  const { prefs } = await cargarPrefs(supabase, c.tenantId);
  const pro = await cargarProfesional(supabase, c.tenantId, s.barber_id);
  if (!pro) return NextResponse.json({ error: "Profesional no encontrado" }, { status: 404 });
  const trabaja = await cargarHorario(supabase, pro.id);
  const ocupados = await cargarOcupados(supabase, pro.id, s.id);
  const hoyAprobar = s.start_date > todayInChile() ? todayInChile() : dateStrOffset(s.start_date, -1);
  const v = validarSolicitud({ hoy: hoyAprobar, inicio: s.start_date, fin: s.end_date, trabaja, diasAnio: prefs.diasPorAnio || 0, modo: prefs.modo, ingreso: pro.ingreso, ocupados: [...ocupados.aprobadas, ...ocupados.pendientes] });
  if (!v.ok) return NextResponse.json({ error: `No se puede aprobar: ${v.error}` }, { status: 409 });

  const { data: vac, error: vErr } = await supabase.from("professional_vacations").insert({
    tenant_id: c.tenantId, barber_id: s.barber_id, start_date: s.start_date, end_date: s.end_date,
    note: s.note ? `Solicitud aprobada · ${s.note}` : "Solicitud aprobada", created_by: c.userId, created_by_name: yo?.name || null,
  }).select("id").single();
  if (vErr || !vac) return NextResponse.json({ error: "No se pudo registrar la vacación." }, { status: 500 });
  const { data: up } = await supabase.from("vacation_requests").update({ ...decision, status: "approved", vacation_id: vac.id }).eq("id", s.id).eq("status", "pending").select("id");
  if (!up || up.length === 0) { await supabase.from("professional_vacations").delete().eq("id", vac.id); return NextResponse.json({ error: "Esa solicitud ya fue resuelta." }, { status: 409 }); }

  const { count } = await supabase.from("appointments").select("id", { count: "exact", head: true }).eq("barber_id", s.barber_id).gte("date", s.start_date).lte("date", s.end_date).in("status", ["scheduled", "confirmed", "in_progress"]);
  await notify({ tenantId: c.tenantId, kind: "vacation_decision", userIds: [s.barber_id], createdBy: c.userId, createdByName: yo?.name, title: "Tus vacaciones fueron aceptadas", body: rango, url: "/dashboard/vacaciones" });
  return NextResponse.json({ success: true, existingAppointments: count || 0, nombre });
}
