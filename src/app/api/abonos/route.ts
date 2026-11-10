import { NextResponse } from "next/server";
import { createAdminSupabase, isManagerLevel } from "@/lib/supabase/server";
import { clasificarAbono, totalesAbonos } from "@/lib/abonos";

export const dynamic = "force-dynamic";

// Abonos recibidos al reservar (solo lectura): administración y recepción, del negocio de la sesión.
export async function GET() {
  const me = await isManagerLevel();
  if (!me.userId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!me.ok || !me.tenantId || me.tenantId === "ALL") return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const sb = createAdminSupabase();
  // applied_transaction_id (migración 152): venta donde ya se descontó el abono. Si falta la columna, se lee sin ella.
  let { data, error }: { data: any[] | null; error: any } = await sb.from("booking_deposits").select("payment_id, appointment_id, amount, status, payer_email, created_at, applied_transaction_id").eq("tenant_id", me.tenantId).order("created_at", { ascending: false }).limit(300);
  if (error) ({ data, error } = await sb.from("booking_deposits").select("payment_id, appointment_id, amount, status, payer_email, created_at").eq("tenant_id", me.tenantId).order("created_at", { ascending: false }).limit(300));
  if (error) return NextResponse.json({ items: [], totales: totalesAbonos([]), migrationMissing: /does not exist|schema cache/i.test(error.message) });
  const rows = data || [];
  const apptIds = Array.from(new Set(rows.map((r: any) => r.appointment_id).filter(Boolean)));
  const citas = new Map<string, any>();
  if (apptIds.length) {
    const { data: ap } = await sb.from("appointments").select("id, date, start_time, status, client:clients(name), barber:profiles!barber_id(name)").in("id", apptIds).eq("tenant_id", me.tenantId);
    for (const a of (ap as any[]) || []) citas.set(a.id, a);
  }
  const items = rows.map((r: any) => {
    const a = r.appointment_id ? citas.get(r.appointment_id) : null;
    return {
      aplicado: r.applied_transaction_id ? true : null, paymentId: r.payment_id, monto: Number(r.amount) || 0, estado: clasificarAbono(r.status), detalle: String(r.status || ""), pagador: r.payer_email, fecha: r.created_at,
      cita: a ? { id: a.id, fecha: a.date, hora: String(a.start_time || "").slice(11, 16), estado: a.status, cliente: a.client?.name || null, profesional: a.barber?.name || null } : null,
    };
  });
  return NextResponse.json({ items, totales: totalesAbonos(rows.map((r: any) => ({ status: r.status, amount: r.amount }))) });
}
