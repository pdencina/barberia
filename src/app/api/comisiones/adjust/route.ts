import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";

// POST: Create manual commission adjustment (super admin only)
export async function POST(req: NextRequest) {
  const supabase = createAdminSupabase();
  const { barberId, amount, type, reason, pin } = await req.json();

  // Validate
  if (!barberId || !amount || !reason || !pin) {
    return NextResponse.json({ error: "barberId, amount, reason y pin son obligatorios" }, { status: 400 });
  }

  // Verify admin or super admin PIN
  const { data: admin } = await supabase
    .from("profiles")
    .select("id, name")
    .in("role", ["admin", "super_admin"])
    .eq("personal_pin", pin)
    .eq("active", true)
    .single();

  if (!admin) {
    return NextResponse.json({ error: "PIN incorrecto o no tiene permisos" }, { status: 401 });
  }

  // Create manual transaction
  const { data: tx, error: txError } = await supabase
    .from("transactions")
    .insert({
      type: type === "deduction" ? "expense" : "income",
      status: "completed",
      subtotal: Math.abs(amount),
      discount: 0,
      total: Math.abs(amount),
      // "adjustment" is NOT a valid payment_method (enum only allows cash, debit_card,
      // credit_card, transfer, mixed) — this was the exact cause of the error. There's
      // no real payment method for a manual adjustment, so we use "cash" and rely on
      // the [AJUSTE MANUAL] tag in notes to make it clear this wasn't an actual cash sale.
      payment_method: "cash",
      barber_id: barberId,
      notes: `[AJUSTE MANUAL] ${reason} — por ${admin.name}`,
    })
    .select()
    .single();

  if (txError) return NextResponse.json({ error: txError.message }, { status: 500 });

  // Log in audit
  await supabase.from("audit_log").insert({
    action: "commission_adjustment",
    entity_type: "transaction",
    entity_id: tx.id,
    description: `Ajuste manual: ${type === "deduction" ? "-" : "+"}$${Math.abs(amount).toLocaleString("es-CL")} — ${reason}`,
    user_id: admin.id,
    user_name: admin.name,
    reversible: true,
    metadata: { barberId, amount, type, reason },
  });

  return NextResponse.json({ success: true, transactionId: tx.id, adjustedBy: admin.name });
}

// DELETE: Remove a transaction (super admin only)
export async function DELETE(req: NextRequest) {
  const supabase = createAdminSupabase();
  const { searchParams } = new URL(req.url);
  const transactionId = searchParams.get("id");
  const pin = searchParams.get("pin");

  if (!transactionId || !pin) {
    return NextResponse.json({ error: "id y pin requeridos" }, { status: 400 });
  }

  // Verify admin or super admin PIN
  const { data: admin } = await supabase
    .from("profiles")
    .select("id, name")
    .in("role", ["admin", "super_admin"])
    .eq("personal_pin", pin)
    .eq("active", true)
    .single();

  if (!admin) {
    return NextResponse.json({ error: "PIN incorrecto" }, { status: 401 });
  }

  // Get transaction info before deleting
  const { data: tx } = await supabase
    .from("transactions")
    .select("total, barber_id, notes")
    .eq("id", transactionId)
    .single();

  // Soft delete (mark as cancelled instead of hard delete)
  await supabase
    .from("transactions")
    .update({ status: "cancelled", notes: `${tx?.notes || ""} [ANULADA por ${admin.name}]` })
    .eq("id", transactionId);

  // Log in audit
  await supabase.from("audit_log").insert({
    action: "transaction_delete",
    entity_type: "transaction",
    entity_id: transactionId,
    description: `Transaccion anulada: $${Number(tx?.total || 0).toLocaleString("es-CL")} — por ${admin.name}`,
    user_id: admin.id,
    user_name: admin.name,
    reversible: false,
  });

  return NextResponse.json({ success: true, deletedBy: admin.name });
}
