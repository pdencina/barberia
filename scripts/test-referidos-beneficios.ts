import assert from "node:assert/strict";
import { montoConDescuento, aplicarBeneficiosReferidos, type RepoBeneficios, type MpBeneficios } from "../src/lib/referidos-beneficios";

let fails = 0;
const t = async (n: string, f: () => Promise<void> | void) => { try { await f(); console.log("OK  " + n); } catch (e: any) { fails++; console.log("FALLO " + n + ": " + e.message); } };

function mundo(o: { referido?: { meses: number; cobros: number; completo: number } | null; credito?: boolean; mpSube?: boolean; mpReembolsa?: boolean }) {
  const est = { cobros: o.referido?.cobros ?? 0, cerrado: false, creditoAplicado: false, subidas: [] as number[], reembolsos: [] as string[] };
  let creditoLibre = !!o.credito;
  const repo: RepoBeneficios = {
    async referidoConDescuento() { return o.referido && !est.cerrado ? { id: "r1", discountMonths: o.referido.meses, discountCharges: est.cobros, fullAmount: o.referido.completo } : null; },
    async sumarCobroConDescuento() { return ++est.cobros; },
    async cerrarDescuento() { est.cerrado = true; },
    async creditoDisponible() { return creditoLibre ? { id: "c1" } : null; },
    async marcarCreditoAplicado() { creditoLibre = false; est.creditoAplicado = true; },
  };
  const mp: MpBeneficios = {
    async subirMonto(_id, m) { est.subidas.push(m); return o.mpSube !== false; },
    async reembolsar(id) { est.reembolsos.push(id); return o.mpReembolsa !== false; },
  };
  return { est, repo, mp };
}
const pago = (monto: number, paymentId: string | null = "pay1") => ({ authorizedPaymentId: "ap1", paymentId, monto });
const base = (monto: number, activo = true) => ({ tenantId: "t1", preapprovalId: "pre1", pago: pago(monto), montoSuscripcion: 20000, activo });

(async () => {
  await t("50% de 19.990 se redondea a peso entero y nunca es 0", () => { assert.equal(montoConDescuento(19990, 50), 9995); assert.equal(montoConDescuento(1, 50), 1); assert.equal(montoConDescuento(15458, 50), 7729); });
  await t("referido: cobro 1 de 2 -> sigue con descuento (no sube el monto)", async () => { const w = mundo({ referido: { meses: 2, cobros: 0, completo: 20000 } }); const r = await aplicarBeneficiosReferidos(base(10000), w.repo, w.mp); assert.equal(r.descuentoCerrado, false); assert.deepEqual(w.est.subidas, []); assert.equal(w.est.cobros, 1); });
  await t("referido: cobro 2 de 2 -> sube al precio normal y cierra", async () => { const w = mundo({ referido: { meses: 2, cobros: 1, completo: 20000 } }); const r = await aplicarBeneficiosReferidos(base(10000), w.repo, w.mp); assert.equal(r.descuentoCerrado, true); assert.deepEqual(w.est.subidas, [20000]); assert.equal(w.est.cerrado, true); });
  await t("referido: si Mercado Pago falla al subir, NO se cierra (el cron lo reintenta) y se avisa", async () => { const w = mundo({ referido: { meses: 2, cobros: 1, completo: 20000 }, mpSube: false }); const r = await aplicarBeneficiosReferidos(base(10000), w.repo, w.mp); assert.equal(r.descuentoCerrado, false); assert.equal(w.est.cerrado, false); assert.equal(r.avisos.length, 1); });
  await t("mes gratis: con credito y cobro completo -> reembolsa ese cobro y consume el credito", async () => { const w = mundo({ credito: true }); const r = await aplicarBeneficiosReferidos(base(20000), w.repo, w.mp); assert.equal(r.mesGratisAplicado, true); assert.deepEqual(w.est.reembolsos, ["pay1"]); assert.equal(w.est.creditoAplicado, true); });
  await t("mes gratis: sin credito no reembolsa nada", async () => { const w = mundo({ credito: false }); await aplicarBeneficiosReferidos(base(20000), w.repo, w.mp); assert.deepEqual(w.est.reembolsos, []); });
  await t("mes gratis: si el reembolso falla, el credito sigue disponible", async () => { const w = mundo({ credito: true, mpReembolsa: false }); const r = await aplicarBeneficiosReferidos(base(20000), w.repo, w.mp); assert.equal(r.mesGratisAplicado, false); assert.equal(w.est.creditoAplicado, false); assert.equal(r.avisos.length, 1); });
  await t("mes gratis: sin id de pago no se reembolsa", async () => { const w = mundo({ credito: true }); const r = await aplicarBeneficiosReferidos({ ...base(20000), pago: pago(20000, null) }, w.repo, w.mp); assert.equal(r.mesGratisAplicado, false); assert.deepEqual(w.est.reembolsos, []); });
  await t("mes gratis: un cobro menor al de la suscripcion (descuento) no se reembolsa", async () => { const w = mundo({ credito: true }); const r = await aplicarBeneficiosReferidos(base(10000), w.repo, w.mp); assert.equal(r.mesGratisAplicado, false); });
  await t("un referido con descuento vigente no recibe reembolso de mes gratis en el mismo cobro", async () => { const w = mundo({ referido: { meses: 2, cobros: 0, completo: 20000 }, credito: true }); const r = await aplicarBeneficiosReferidos(base(20000), w.repo, w.mp); assert.equal(r.mesGratisAplicado, false); assert.deepEqual(w.est.reembolsos, []); });
  await t("interruptor apagado: no hace nada", async () => { const w = mundo({ referido: { meses: 2, cobros: 1, completo: 20000 }, credito: true }); const r = await aplicarBeneficiosReferidos(base(20000, false), w.repo, w.mp); assert.deepEqual(r, { descuentoCerrado: false, mesGratisAplicado: false, avisos: [] }); assert.deepEqual(w.est.subidas, []); assert.deepEqual(w.est.reembolsos, []); assert.equal(w.est.cobros, 1); });
  await t("cobro de monto 0 no hace nada", async () => { const w = mundo({ credito: true }); await aplicarBeneficiosReferidos({ ...base(0) }, w.repo, w.mp); assert.deepEqual(w.est.reembolsos, []); });
  process.exit(fails ? 1 : 0);
})();
