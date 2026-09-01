import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";

// POST: "Cancel" a TUU payment intent LOCALLY only.
// Unlike MercadoPago (which has a real /orders/{id}/cancel endpoint), TUU's public
// "Pago Remoto" docs do not expose any endpoint to cancel a request already sent to
// the terminal. So this only stops our own polling and marks the local record as
// cancelled — the physical POS itself may keep waiting for a card until the cashier
// cancels it manually on the machine (or it times out on TUU's side). The frontend
// must warn the cashier of this when they hit "Cancelar" during a TUU charge.
export async function POST(req: NextRequest) {
  const supabase = createAdminSupabase();
  const body = await req.json().catch(() => ({}));
  const { idempotencyKey, cancelAll, barberId } = body;

  if (idempotencyKey) {
    await supabase
      .from("tuu_payment_intents")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("idempotency_key", idempotencyKey);
    return NextResponse.json({ success: true, note: "Cancelado solo en nuestro sistema. Si la maquina TUU sigue esperando la tarjeta, cancelalo tambien ahi." });
  }

  if (cancelAll) {
    let query = supabase.from("tuu_payment_intents").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("status", "pending");
    if (barberId) {
      const { data: barber } = await supabase.from("profiles").select("tenant_id").eq("id", barberId).single();
      if (barber?.tenant_id) query = query.eq("tenant_id", barber.tenant_id);
    }
    await query;
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "idempotencyKey o cancelAll requerido" }, { status: 400 });
}
