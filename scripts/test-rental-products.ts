// Cosméticos vendidos por profesionales de arriendo. Uso: npx tsx scripts/test-rental-products.ts
import assert from "node:assert/strict";
import { calcularProductosArriendo, repartoDeLaVenta, type ConfigNegocio, type ConfigProfesional, type Venta } from "../src/lib/rental-products";
let fails = 0;
const t = (n: string, f: () => void) => { try { f(); console.log("OK  " + n); } catch (e: any) { fails++; console.log("MAL " + n + ": " + e.message); } };

const NEG: ConfigNegocio = { mode: "business_collects", from: "2026-11-01", cardToBarber: true };
const PRO: ConfigProfesional = { cashToBarber: false, transferToBarber: false, cashCounted: true };
const V = (id: string, method: string, total = 18000, createdAt = "2026-11-05T15:00:00Z", parts?: any[]): [string, Venta] => [id, { id, method, total, createdAt, parts }];
const item = (txId: string, total = 18000, commission = 2000, isCosmetic = true) => ({ txId, total, commission, isCosmetic });
const calc = (items: any[], ventas: Array<[string, Venta]>, n = NEG, p = PRO) => calcularProductosArriendo(items, new Map(ventas), n, p);

t("débito con máquina del profesional: paga precio menos comisión", () => { assert.deepEqual(calc([item("a")], [V("a", "debit_card")]), { owed: 16000, credit: 0, cashHeldAdjust: 0 }); });
t("crédito igual que débito", () => { assert.equal(calc([item("a")], [V("a", "credit_card")]).owed, 16000); });
t("tarjetas que entran al negocio: solo su comisión a favor", () => { assert.deepEqual(calc([item("a")], [V("a", "debit_card")], { ...NEG, cardToBarber: false }), { owed: 0, credit: 2000, cashHeldAdjust: 0 }); });
t("efectivo que se lleva el profesional: paga precio menos comisión", () => { assert.deepEqual(calc([item("a")], [V("a", "cash")], NEG, { ...PRO, cashToBarber: true, cashCounted: false }), { owed: 16000, credit: 0, cashHeldAdjust: 0 }); });
t("efectivo en caja (ya acreditado por arriendo): queda solo la comisión", () => { assert.deepEqual(calc([item("a")], [V("a", "cash")]), { owed: 0, credit: 2000, cashHeldAdjust: 18000 }); });
t("efectivo en caja pero aún no se descuenta del arriendo: solo comisión, sin ajustar", () => { assert.deepEqual(calc([item("a")], [V("a", "cash")], NEG, { ...PRO, cashCounted: false }), { owed: 0, credit: 2000, cashHeldAdjust: 0 }); });
t("transferencia al negocio: comisión a favor; a la cuenta del profesional: paga", () => {
  assert.deepEqual(calc([item("a")], [V("a", "transfer")]), { owed: 0, credit: 2000, cashHeldAdjust: 0 });
  assert.deepEqual(calc([item("a")], [V("a", "transfer")], NEG, { ...PRO, transferToBarber: true }), { owed: 16000, credit: 0, cashHeldAdjust: 0 });
});
t("pago mixto: se reparte según cada parte (9.000 débito al profesional + 9.000 efectivo en caja)", () => {
  const r = calc([item("a")], [V("a", "mixed", 18000, "2026-11-05T15:00:00Z", [{ method: "debit_card", amount: 9000 }, { method: "cash", amount: 9000 }])]);
  assert.deepEqual(r, { owed: 8000, credit: 1000, cashHeldAdjust: 9000 });
});
t("solo cosméticos: un consumible no genera nada", () => { assert.deepEqual(calc([item("a", 1500, 0, false)], [V("a", "debit_card", 1500)]), { owed: 0, credit: 0, cashHeldAdjust: 0 }); });
t("antes de la fecha de inicio (octubre) no cambia nada", () => { assert.deepEqual(calc([item("a")], [V("a", "debit_card", 18000, "2026-10-20T15:00:00Z")]), { owed: 0, credit: 0, cashHeldAdjust: 0 }); });
t("1 de noviembre a las 02:00 UTC todavía es octubre en Chile", () => { assert.equal(calc([item("a")], [V("a", "debit_card", 18000, "2026-11-01T02:00:00Z")]).owed, 0); });
t("sin fecha de inicio vale para todas las ventas", () => { assert.equal(calc([item("a")], [V("a", "debit_card", 18000, "2026-01-10T15:00:00Z")], { ...NEG, from: null }).owed, 16000); });
t("apagado: igual que antes", () => { assert.deepEqual(calc([item("a")], [V("a", "debit_card")], { ...NEG, mode: "off" }), { owed: 0, credit: 0, cashHeldAdjust: 0 }); });
t("comisión 0 (negocio sin comisión): paga el precio completo", () => { assert.equal(calc([item("a", 18000, 0)], [V("a", "debit_card")]).owed, 18000); });
t("la comisión nunca supera al precio", () => { assert.equal(calc([item("a", 1000, 5000)], [V("a", "debit_card", 1000)]).owed, 0); });
t("varios productos suman", () => { assert.equal(calc([item("a"), item("b", 23490, 2000)], [V("a", "debit_card"), V("b", "debit_card", 23490)]).owed, 16000 + 21490); });
t("reparto de una venta mixta sin partes: nada al profesional", () => { assert.deepEqual(repartoDeLaVenta({ id: "x", createdAt: "2026-11-05T15:00:00Z", method: "mixed", total: 1000 }, NEG, PRO), { aPro: 0, efectivoEnCajaContado: 0 }); });
process.exit(fails ? 1 : 0);
