import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, canAccessBarber } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/pos-access";

// POST: "Cancel" a TUU payment intent LOCALLY only.
// Unlike MercadoPago (which has a real /orders/{id}/cancel endpoint), TUU's public
// "Pago Remoto" docs do not expose any endpoint to cancel a request already sent to
// the terminal. So this only stops our own polling and marks the local record as
// cancelled — the physical POS itself may keep waiting for a card until the cashier
// cancels it manually on the machine (or it times out on TUU's side). The frontend
// must warn the cashier of this when they hit "Cancelar" during a TUU charge.
export async function POST(req: NextRequest) {
  const supabase = createAdminSupabase();
  const staff = await requireStaff();
  if (!staff.ok) return staff.response;
  const body = await req.json().catch(() => ({}));
  const { idempotencyKey, cancelAll, barberId } = body;

  if (idempotencyKey) {
    // El cobro debe ser del negocio de quien cancela (super admin: cualquiera).
    const { data: intent } = await supabase.from("tuu_payment_intents").select("tenant_id").eq("idempotency_key", idempotencyKey).maybeSingle();
    if (!intent || (staff.role !== "super_admin" && (!staff.tenantId || (intent as any).tenant_id !== staff.tenantId))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    await supabase
      .from("tuu_payment_intents")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("idempotency_key", idempotencyKey);
    return NextResponse.json({ success: true, note: "Cancelado solo en nuestro sistema. Si la maquina TUU sigue esperando la tarjeta, cancelalo tambien ahi." });
  }

  if (cancelAll) {
    let query = supabase.from("tuu_payment_intents").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("status", "pending");
    // Antes, sin barberId se cancelaban los cobros pendientes de TODOS los negocios. Ahora siempre se acota al negocio de quien cancela.
    if (staff.role === "super_admin" && barberId) {
      const { data: barber } = await supabase.from("profiles").select("tenant_id").eq("id", barberId).single();
      if (!barber?.tenant_id) return NextResponse.json({ error: "Profesional no encontrado" }, { status: 404 });
      query = query.eq("tenant_id", barber.tenant_id);
    } else if (staff.role !== "super_admin") {
      if (!staff.tenantId) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
      if (typeof barberId === "string" && !(await canAccessBarber(barberId))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
      query = query.eq("tenant_id", staff.tenantId);
    }
    await query;
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "idempotencyKey o cancelAll requerido" }, { status: 400 });
}
