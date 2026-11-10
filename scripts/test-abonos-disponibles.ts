// Abonos disponibles para descontar al cobrar. Uso: npx tsx scripts/test-abonos-disponibles.ts
import assert from "node:assert/strict";
import { elegirAbonos, type AbonoDisponible } from "../src/lib/abonos-disponibles";
let fails = 0;
const t = (n: string, f: () => void) => { try { f(); console.log("OK  " + n); } catch (e: any) { fails++; console.log("MAL " + n + ": " + e.message); } };
const A = (id: string, monto: number, fecha: string): AbonoDisponible => ({ paymentId: id, monto, citaId: null, fecha, citaEstado: null });

t("un abono menor al servicio se usa completo", () => { const r = elegirAbonos([A("a", 10000, "2026-10-30")], 30000); assert.equal(r.monto, 10000); assert.equal(r.usados.length, 1); });
t("el abono nunca pasa de lo que falta cobrar", () => { const r = elegirAbonos([A("a", 10000, "2026-10-30")], 6000); assert.equal(r.monto, 6000); });
t("dos abonos: se usan los más antiguos primero hasta cubrir el servicio", () => {
  const r = elegirAbonos([A("b", 10000, "2026-11-02"), A("a", 10000, "2026-10-30")], 15000);
  assert.deepEqual(r.usados.map((x) => x.paymentId), ["a", "b"]); assert.equal(r.monto, 15000);
});
t("si el primer abono ya cubre todo, el segundo queda disponible", () => {
  const r = elegirAbonos([A("a", 20000, "2026-10-30"), A("b", 10000, "2026-11-02")], 20000);
  assert.deepEqual(r.usados.map((x) => x.paymentId), ["a"]);
});
t("sin servicio que cubrir no se usa ningún abono", () => { const r = elegirAbonos([A("a", 10000, "2026-10-30")], 0); assert.equal(r.usados.length, 0); assert.equal(r.monto, 0); });
process.exit(fails ? 1 : 0);
