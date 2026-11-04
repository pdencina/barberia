// Un mismo pago puede avisarse VARIAS veces y casi al mismo tiempo (Mercado Pago manda el aviso del pago y de la orden juntos).
// Antes, dos avisos simultaneos pasaban la revision de «ya se creo la cita», uno creaba la cita y el otro encontraba esa cita, creia que el horario
// se habia ocupado y avisaba un «choque» falso. Ahora el primer aviso RESERVA el pago (fila con estado «processing») y los demas se descartan.
export type FilaPago = { status: string; created_at: string } | null;
export const ESTADOS_FINALES = ["approved", "needs_refund", "refunded"];
export const SEGUNDOS_PROCESANDO = 120; // un «processing» mas viejo que esto se considera trabado y puede retomarse

export type Reclamo = "tomar" | "descartar" | "retomar";
// ¿Qué hace este aviso con el pago? (puro)
export function decidirReclamo(existente: FilaPago, ahora: number): Reclamo {
  if (!existente) return "tomar";
  if (ESTADOS_FINALES.includes(existente.status)) return "descartar";
  if (existente.status === "processing") return ahora - new Date(existente.created_at).getTime() > SEGUNDOS_PROCESANDO * 1000 ? "retomar" : "descartar";
  return "retomar"; // intento anterior sin aprobar («pending:…», «rejected:…»): ahora esta aprobado, se procesa
}

// true = este aviso debe procesar el pago; false = otro aviso ya lo esta procesando o ya lo proceso.
export async function reclamarPago(supabase: any, o: { tenantId: string; paymentId: string; amount: number; email: string | null }): Promise<boolean> {
  const fila = { tenant_id: o.tenantId, payment_id: o.paymentId, amount: Math.max(0, Math.round(o.amount) || 0), status: "processing", payer_email: o.email };
  const ins = await supabase.from("booking_deposits").insert(fila);
  if (!ins.error) return true;
  if (!/duplicate|unique|23505/i.test(`${ins.error.code || ""} ${ins.error.message || ""}`)) return true; // sin la tabla (migracion 131): se sigue como antes
  const { data: ex } = await supabase.from("booking_deposits").select("status, created_at").eq("payment_id", o.paymentId).maybeSingle();
  const d = decidirReclamo(ex, Date.now());
  if (d === "descartar") return false;
  if (d === "tomar") return true;
  // Retomar con comparacion: solo uno de los avisos simultaneos logra cambiar la fila.
  const { data: upd } = await supabase.from("booking_deposits").update({ status: "processing", created_at: new Date().toISOString() }).eq("payment_id", o.paymentId).eq("status", ex!.status).eq("created_at", ex!.created_at).select("payment_id");
  return Array.isArray(upd) && upd.length > 0;
}
