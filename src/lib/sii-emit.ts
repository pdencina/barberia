// Emite la boleta electronica de UNA venta con la cuenta SII del negocio y la deja registrada.
// La usan el boton manual (/api/boletas/emit) y el cobro del POS (emision automatica).
import { emitBoleta, SiiConfig } from "@/lib/sii";

export interface EmitForTxResult {
  ok: boolean;
  skipped?: string;          // por que no se intento (apagado, sin migracion...) — no es un error
  error?: string;
  status?: number;           // sugerencia de codigo HTTP para la ruta manual
  folio?: number;
  pdfUrl?: string | null;
  pdfBase64?: string | null;
  environment?: string;
}

export async function emitForTransaction(
  supabase: any,
  tenantId: string,
  transactionId: string,
  opts: { onlyAuto?: boolean } = {}
): Promise<EmitForTxResult> {
  const { data: config, error: cfgErr } = await supabase
    .from("tenant_billing_sii").select("*").eq("tenant_id", tenantId).maybeSingle();
  if (cfgErr) return { ok: false, skipped: "Falta aplicar la migración 116", error: "Falta aplicar la migración 116", status: 503 };
  if (!config?.enabled) return { ok: false, skipped: "apagada", error: "La boleta electrónica no está activada en este negocio", status: 400 };
  if (opts.onlyAuto && !config.auto_emit) return { ok: false, skipped: "manual" };

  const { data: tx } = await supabase
    .from("transactions")
    .select("id, type, status, total, payment_method, client:clients(name, rut), items:transaction_items(description, quantity, unit_price, total)")
    .eq("id", transactionId).eq("tenant_id", tenantId).maybeSingle();
  if (!tx) return { ok: false, error: "Venta no encontrada", status: 404 };
  if (tx.type !== "income" || tx.status !== "completed") {
    return { ok: false, error: "Solo se emite boleta de ventas completadas", status: 400 };
  }

  const { data: existing } = await supabase
    .from("boletas_emitidas").select("id").eq("transaction_id", transactionId).eq("status", "emitida").maybeSingle();
  if (existing) return { ok: false, error: "Ya se emitió boleta para esta venta", status: 409 };

  const result = await emitBoleta(config as SiiConfig, {
    items: (tx.items || []).map((i: any) => ({ name: i.description, quantity: i.quantity, unitPrice: Number(i.unit_price), total: Number(i.total) })),
    total: Number(tx.total),
    paymentMethod: tx.payment_method,
    clientRut: tx.client?.rut || null,
    clientName: tx.client?.name || null,
    transactionId: tx.id,
  });
  if (!result.success) return { ok: false, error: result.error, status: 502 };

  const row = {
    transaction_id: transactionId, folio: result.folio, tipo_dte: 39, monto_total: Number(tx.total),
    pdf_url: result.pdfUrl || null, client_rut: tx.client?.rut || null, status: "emitida",
  };
  // tenant_id/environment vienen de la migracion 116; si faltaran, se guarda igual sin ellos.
  const { error: insErr } = await supabase.from("boletas_emitidas").insert({ ...row, tenant_id: tenantId, environment: config.environment });
  if (insErr) await supabase.from("boletas_emitidas").insert(row);
  await supabase.from("transactions").update({ boleta_folio: result.folio, boleta_emitida: true }).eq("id", transactionId);

  return { ok: true, folio: result.folio, pdfUrl: result.pdfUrl, pdfBase64: result.pdfBase64 || null, environment: config.environment };
}
