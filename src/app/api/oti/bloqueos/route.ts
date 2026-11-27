import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, authorizeBarberManagement } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/accounting";
import { todayInChile } from "@/lib/utils";
import { resumenHorario } from "@/lib/oti/quitar-bloqueo";

export const dynamic = "force-dynamic";

// Oti: quitar los bloqueos manuales de un profesional (desde hoy). Un profesional solo los suyos; recepción y administración, los de su negocio.
// Antes de borrar se guarda una copia completa en la auditoría: se puede deshacer. No toca citas, vacaciones ni horas tomadas por un abono en curso.
const ACCION = "oti_bloqueos_quitados";
const trozos = <T,>(a: T[], n: number) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));

async function permiso(barberId: unknown) {
  if (typeof barberId !== "string" || !/^[0-9a-f-]{36}$/i.test(barberId)) return null;
  const a = await authorizeBarberManagement(barberId, { allowSelf: true });
  return a.ok ? { ...a, barberId } : null;
}
const manuales = (sb: any, barberId: string) => fetchAllRows<any>(() => sb.from("barber_blocks").select("*").eq("barber_id", barberId).gte("date", todayInChile()))
  .then((l) => l.filter((b: any) => !b.hold_ref));
const NO = () => NextResponse.json({ error: "No tienes permiso para cambiar los bloqueos de ese profesional." }, { status: 403 });

export async function GET(req: NextRequest) {
  const p = await permiso(new URL(req.url).searchParams.get("barberId"));
  if (!p) return NO();
  const sb = createAdminSupabase();
  try {
    const filas = await manuales(sb, p.barberId);
    const { data: horario } = await sb.from("barber_schedule").select("day_of_week, is_working, start_time, end_time").eq("barber_id", p.barberId);
    const fechas = filas.map((f: any) => String(f.date)).sort();
    return NextResponse.json({ total: filas.length, desde: fechas[0] || null, hasta: fechas[fechas.length - 1] || null, horario: resumenHorario((horario as any[]) || []) });
  } catch { return NextResponse.json({ error: "No pude leer los bloqueos" }, { status: 500 }); }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const p = await permiso(body.barberId);
  if (!p) return NO();
  const sb = createAdminSupabase();
  const { data: pro } = await sb.from("profiles").select("name, tenant_id").eq("id", p.barberId).maybeSingle();
  const { data: yo } = await sb.from("profiles").select("name").eq("id", p.userId as string).maybeSingle();

  if (body.accion === "quitar") {
    let filas: any[];
    try { filas = await manuales(sb, p.barberId); } catch { return NextResponse.json({ error: "No pude leer los bloqueos" }, { status: 500 }); }
    if (!filas.length) return NextResponse.json({ quitados: 0 });
    const { data: copia, error } = await sb.from("audit_log").insert({
      action: ACCION, entity_type: "profile", entity_id: p.barberId, user_id: p.userId, reversible: false, user_name: (yo as any)?.name || "Usuario",
      description: `Oti: se quitaron ${filas.length} bloqueos de ${(pro as any)?.name || "un profesional"}`, metadata: { tenantId: (pro as any)?.tenant_id, filas },
    }).select("id").single();
    if (error) console.error("[oti bloqueos] respaldo:", error.message);
    if (error || !copia) return NextResponse.json({ error: "No pude guardar la copia de respaldo, así que no borré nada." }, { status: 500 });
    for (const ids of trozos(filas.map((f) => f.id), 150)) {
      const { error: e } = await sb.from("barber_blocks").delete().eq("barber_id", p.barberId).in("id", ids);
      if (e) return NextResponse.json({ error: "Se cortó a la mitad. Puedes deshacer o intentar de nuevo.", respaldo: (copia as any).id }, { status: 500 });
    }
    return NextResponse.json({ quitados: filas.length, respaldo: (copia as any).id });
  }

  if (body.accion === "deshacer") {
    const { data: copia } = await sb.from("audit_log").select("metadata").eq("id", String(body.respaldo || "")).eq("action", ACCION).eq("entity_id", p.barberId).maybeSingle();
    const filas: any[] = ((copia as any)?.metadata?.filas || []).filter((f: any) => f?.barber_id === p.barberId);
    if (!filas.length) return NextResponse.json({ error: "No encontré la copia de esos bloqueos" }, { status: 404 });
    for (const grupo of trozos(filas, 400)) {
      const { error } = await sb.from("barber_blocks").upsert(grupo, { onConflict: "id", ignoreDuplicates: true });
      if (error) return NextResponse.json({ error: "No pude restaurarlos todos. Intenta de nuevo." }, { status: 500 });
    }
    return NextResponse.json({ restaurados: filas.length });
  }
  return NextResponse.json({ error: "Pedido no válido" }, { status: 400 });
}
