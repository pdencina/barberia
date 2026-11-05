// Formatos de los gráficos del Dashboard. Uso: npx tsx scripts/test-dashboard-format.ts
import assert from "node:assert/strict";
import { montoCorto, marcasEje, resumenPeriodo, ventasPorMedio } from "../src/lib/dashboard-format";
let fails = 0;
const t = (n: string, f: () => void) => { try { f(); console.log("OK  " + n); } catch (e: any) { fails++; console.log("MAL " + n + ": " + e.message); } };
t("montos cortos", () => {
  assert.equal(montoCorto(900), "$900");
  assert.equal(montoCorto(1500), "$1,5 mil");
  assert.equal(montoCorto(350000), "$350 mil");
  assert.equal(montoCorto(1250000), "$1,25 M");
  assert.equal(montoCorto(12000000), "$12 M");
  assert.equal(montoCorto(0), "$0");
  assert.equal(montoCorto(-2000), "-$2 mil");
});
t("marcas del eje redondas y cubren el máximo", () => {
  assert.deepEqual(marcasEje(0), [0, 1]);
  const m = marcasEje(870000);
  assert.equal(m[0], 0);
  assert.ok(m[m.length - 1] >= 870000);
  assert.ok(m.length <= 7);
  assert.deepEqual(marcasEje(100, 4), [0, 25, 50, 75, 100]);
});
t("resumen del período", () => {
  const r = resumenPeriodo([{ label: "a", date: "1", total: 0 }, { label: "b", date: "2", total: 100 }, { label: "c", date: "3", total: 300 }]);
  assert.equal(r.total, 400);
  assert.equal(r.promedio, 200);
  assert.equal(r.mejor?.label, "c");
  assert.equal(r.conVenta, 2);
});
t("medios de pago: el mixto se reparte por partes", () => {
  const r = ventasPorMedio(
    [{ id: "1", total: 10000, payment_method: "cash" }, { id: "2", total: 20000, payment_method: "mixed" }, { id: "3", total: 5000, payment_method: "debit_card" }],
    [{ transaction_id: "2", payment_method: "cash", amount: 5000 }, { transaction_id: "2", payment_method: "transfer", amount: 15000 }]
  );
  const m = Object.fromEntries(r.map((x) => [x.medio, x.total]));
  assert.deepEqual(m, { cash: 15000, transfer: 15000, debit_card: 5000 });
});
process.exit(fails ? 1 : 0);
