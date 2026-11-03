// Referidos, etapas 2 y 3. La logica de decidir es pura (se prueba sin red); lo que habla con Mercado Pago y la base entra por `repo` y `mp`.
// Todo se llama dentro de try/catch desde el webhook: un fallo aqui NUNCA debe impedir que se registre un pago.
export const montoConDescuento = (completo: number, pct: number) => Math.max(1, Math.round((completo * (100 - pct)) / 100));

export interface ReferidoConDescuento { id: string; discountMonths: number; discountCharges: number; fullAmount: number }
export interface CreditoMes { id: string }
export interface PagoAprobado { authorizedPaymentId: string; paymentId: string | null; monto: number }

export interface RepoBeneficios {
  referidoConDescuento(tenantId: string): Promise<ReferidoConDescuento | null>;     // negocio referido con descuento aun vigente
  sumarCobroConDescuento(referidoId: string): Promise<number>;                      // devuelve el total de cobros con descuento
  cerrarDescuento(referidoId: string): Promise<void>;
  creditoDisponible(tenantId: string): Promise<CreditoMes | null>;                  // mes gratis ganado por quien invito
  marcarCreditoAplicado(creditoId: string, paymentId: string): Promise<void>;
}
export interface MpBeneficios {
  subirMonto(preapprovalId: string, monto: number): Promise<boolean>;
  reembolsar(paymentId: string, clave: string): Promise<boolean>;
}
export interface ResultadoBeneficios { descuentoCerrado: boolean; mesGratisAplicado: boolean; avisos: string[] }

// Cada cobro aprobado: (a) cuenta el cobro con descuento y, al terminar los meses, vuelve al precio normal; (b) si el negocio gano un mes gratis, reembolsa ese cobro.
export async function aplicarBeneficiosReferidos(
  o: { tenantId: string; preapprovalId: string; pago: PagoAprobado; montoSuscripcion: number; activo: boolean },
  repo: RepoBeneficios, mp: MpBeneficios
): Promise<ResultadoBeneficios> {
  const out: ResultadoBeneficios = { descuentoCerrado: false, mesGratisAplicado: false, avisos: [] };
  if (!o.activo || !(o.pago.monto > 0)) return out;

  // (a) Descuento del referido
  const ref = await repo.referidoConDescuento(o.tenantId);
  if (ref) {
    const total = await repo.sumarCobroConDescuento(ref.id);
    if (total >= ref.discountMonths) {
      if (await mp.subirMonto(o.preapprovalId, ref.fullAmount)) { await repo.cerrarDescuento(ref.id); out.descuentoCerrado = true; }
      else out.avisos.push("No se pudo volver al precio normal; el cron diario lo reintenta.");
    }
  }

  // (b) Mes gratis de quien invito: se reembolsa el cobro. Nunca se reembolsa un cobro con descuento del propio referido ni uno sin id de pago.
  if (!out.descuentoCerrado && !ref) {
    const credito = await repo.creditoDisponible(o.tenantId);
    if (credito && o.pago.paymentId && o.pago.monto >= o.montoSuscripcion * 0.99) {
      if (await mp.reembolsar(o.pago.paymentId, `ref-credito-${credito.id}`)) { await repo.marcarCreditoAplicado(credito.id, o.pago.paymentId); out.mesGratisAplicado = true; }
      else out.avisos.push("No se pudo reembolsar el cobro del mes gratis; el credito sigue disponible.");
    }
  }
  return out;
}

// Implementacion real con Supabase y la API de Mercado Pago.
export function repoSupabase(db: any): RepoBeneficios {
  return {
    async referidoConDescuento(tenantId) {
      const { data } = await db.from("referrals").select("id, discount_months, discount_charges, full_amount").eq("referred_tenant_id", tenantId).is("discount_ended_at", null).gt("discount_months", 0).maybeSingle();
      return data ? { id: data.id, discountMonths: data.discount_months, discountCharges: data.discount_charges || 0, fullAmount: data.full_amount } : null;
    },
    async sumarCobroConDescuento(id) {
      const { data } = await db.from("referrals").select("discount_charges").eq("id", id).maybeSingle();
      const n = (data?.discount_charges || 0) + 1;
      await db.from("referrals").update({ discount_charges: n }).eq("id", id);
      return n;
    },
    async cerrarDescuento(id) { await db.from("referrals").update({ discount_ended_at: new Date().toISOString() }).eq("id", id); },
    async creditoDisponible(tenantId) {
      const { data } = await db.from("referral_credits").select("id").eq("tenant_id", tenantId).eq("status", "disponible").order("created_at", { ascending: true }).limit(1).maybeSingle();
      return data ? { id: data.id } : null;
    },
    async marcarCreditoAplicado(id, paymentId) { await db.from("referral_credits").update({ status: "aplicado", applied_payment_id: paymentId, applied_at: new Date().toISOString() }).eq("id", id).eq("status", "disponible"); },
  };
}

export function mpReal(accessToken: string, api = "https://api.mercadopago.com"): MpBeneficios {
  return {
    async subirMonto(preapprovalId, monto) {
      const r = await fetch(`${api}/preapproval/${preapprovalId}`, { method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` }, body: JSON.stringify({ auto_recurring: { transaction_amount: monto, currency_id: "CLP" } }) });
      return r.ok;
    },
    async reembolsar(paymentId, clave) {
      const r = await fetch(`${api}/v1/payments/${paymentId}/refunds`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}`, "X-Idempotency-Key": clave }, body: "{}" });
      return r.ok;
    },
  };
}
