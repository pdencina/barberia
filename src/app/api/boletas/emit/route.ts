import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, isManagerLevel } from "@/lib/supabase/server";
import { emitBoleta } from "@/lib/sii";

// POST: Emit a boleta electrónica for a transaction
export async function POST(req: NextRequest) {
  const supabase = createAdminSupabase();
  // SEGURIDAD: antes no pedia sesion: cualquiera con el id de una venta podia emitir su boleta electronica. Solo la gestion del negocio de esa venta.
  const me = await isManagerLevel();
  if (!me.userId) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (!me.ok) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const { transactionId } = await req.json();

  if (!transactionId) {
    return NextResponse.json({ error: "transactionId requerido" }, { status: 400 });
  }

  // Get transaction details
  const { data: tx } = await supabase
    .from("transactions")
    .select(`
      id, total, subtotal, discount, payment_method, tenant_id,
      client:clients(name, rut, email),
      items:transaction_items(description, quantity, unit_price, total)
    `)
    .eq("id", transactionId)
    .single();

  if (!tx || (me.role !== "super_admin" && (!me.tenantId || (tx as any).tenant_id !== me.tenantId))) return NextResponse.json({ error: "Transaccion no encontrada" }, { status: 404 });

  // Check if boleta already emitted
  const { data: existing } = await supabase
    .from("boletas_emitidas")
    .select("id")
    .eq("transaction_id", transactionId)
    .single();

  if (existing) {
    return NextResponse.json({ error: "Boleta ya fue emitida para esta transaccion" }, { status: 409 });
  }

  // Emit via SII provider
  const result = await emitBoleta({
    items: (tx.items || []).map((item: any) => ({
      name: item.description,
      quantity: item.quantity,
      unitPrice: Number(item.unit_price),
      total: Number(item.total),
    })),
    total: Number(tx.total),
    paymentMethod: tx.payment_method,
    clientRut: (tx.client as any)?.rut || null,
    clientName: (tx.client as any)?.name || null,
    transactionId: tx.id,
  });

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  // Save boleta record
  await supabase.from("boletas_emitidas").insert({
    transaction_id: transactionId,
    folio: result.folio,
    tipo_dte: 39,
    monto_total: Number(tx.total),
    pdf_url: result.pdfUrl || null,
    client_rut: (tx.client as any)?.rut || null,
    status: "emitida",
  });

  // Update transaction
  await supabase
    .from("transactions")
    .update({ boleta_folio: result.folio, boleta_emitida: true })
    .eq("id", transactionId);

  return NextResponse.json({
    success: true,
    folio: result.folio,
    pdfUrl: result.pdfUrl,
  });
}
