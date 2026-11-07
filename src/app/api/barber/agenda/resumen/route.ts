import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, getCallerForView } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/accounting";
import { newClientAppointmentIds } from "@/lib/new-client";
import { summarizeAgenda } from "@/lib/agenda-summary";
import { todayInChile } from "@/lib/utils";

export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  const caller = await getCallerForView();
  if (!caller.userId) return NextResponse.json({ error: "Sin sesión" }, { status: 401 });
  const barberId = req.nextUrl.searchParams.get("barberId");
  const date = req.nextUrl.searchParams.get("date") || todayInChile();
  if (!barberId || !/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date + "T12:00:00Z"))) {
    return NextResponse.json({ error: "Fecha o profesional inválido" }, { status: 400 });
  }
  const manager = ["admin", "receptionist", "super_admin"].includes(caller.role || "");
  if (!caller.tenantId || caller.tenantId === "ALL" || (!manager && !(caller.role === "barber" && caller.userId === barberId))) {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }
  const db = createAdminSupabase();
  const { data: profile, error } = await db.from("profiles")
    .select("commission_rate, work_mode").eq("id", barberId).eq("tenant_id", caller.tenantId).maybeSingle();
  if (error) return NextResponse.json({ error: "No se pudo cargar el porcentaje" }, { status: 503 });
  if (!profile) return NextResponse.json({ error: "Profesional no disponible" }, { status: 403 });
  try {
    const rows = await fetchAllRows(() => db.from("appointments")
      .select("id, client_id, date, start_time, status, services:appointment_services(price)")
      .eq("tenant_id", caller.tenantId).eq("barber_id", barberId).eq("date", date)
      .in("status", ["scheduled", "confirmed", "in_progress", "completed"]));
    let newIds: Set<string> | null = new Set();
    try {
      // Lotes pequeños: el historial contempla todos los profesionales del negocio.
      for (let i = 0; i < rows.length; i += 100) {
        const ids = await newClientAppointmentIds(db, rows.slice(i, i + 100), { tenantId: caller.tenantId, strict: true });
        for (const id of Array.from(ids)) newIds.add(id);
      }
    } catch { newIds = null; }
    return NextResponse.json(summarizeAgenda(rows, newIds, profile));
  } catch {
    return NextResponse.json({ error: "No se pudo cargar el resumen" }, { status: 503 });
  }
}
