// Mi Billetera: ahorro recomendado, reparto y reporte. Uso: npx tsx scripts/test-billetera.ts
import assert from "node:assert/strict";
import { ahorroRecomendado, repartoMes, gastosPorCategoria, lecturaDelMes, variacion } from "../src/lib/billetera";
let fails = 0;
const t = (n: string, f: () => void) => { try { f(); console.log("OK  " + n); } catch (e: any) { fails++; console.log("MAL " + n + ": " + e.message); } };

t("ahorro recomendado según el sueldo y la realidad de gastos", () => {
  assert.equal(ahorroRecomendado(0, null).pct, 10);
  assert.equal(ahorroRecomendado(800_000, 300_000).pct, 20);        // gasta 37 %: meta ideal
  assert.equal(ahorroRecomendado(800_000, 480_000).pct, 15);        // 60 %
  assert.equal(ahorroRecomendado(800_000, 600_000).pct, 12);        // 75 %
  assert.equal(ahorroRecomendado(800_000, 720_000).pct, 8);         // 90 %
  assert.equal(ahorroRecomendado(800_000, 790_000).pct, 5);         // casi todo
  assert.equal(ahorroRecomendado(400_000, 100_000).pct, 10);        // sueldo bajo: tope 10 %
  assert.equal(ahorroRecomendado(2_000_000, 600_000).pct, 25);      // sueldo alto y holgado
  assert.equal(ahorroRecomendado(800_000, null).pct, 20);           // sin datos de gastos: meta ideal
});
t("reparto: gastos + ahorro + saldo suman la base", () => {
  const r = repartoMes({ sueldo: 1_000_000, otrosIngresos: 200_000, gastos: 500_000, ahorroPct: 15 });
  assert.equal(r.base, 1_200_000); assert.equal(r.ahorro, 180_000); assert.equal(r.saldo, 520_000);
  assert.equal(r.gastos + r.ahorro + r.saldo, r.base); assert.equal(r.sobregiro, 0);
  assert.deepEqual(r.pct, { gastos: 42, ahorro: 15, saldo: 43 });
});
t("reparto: si se pasa, el saldo es 0 y se informa el sobregiro; el ahorro no se toca", () => {
  const r = repartoMes({ sueldo: 500_000, otrosIngresos: 0, gastos: 480_000, ahorroPct: 10 });
  assert.equal(r.ahorro, 50_000); assert.equal(r.saldo, 0); assert.equal(r.sobregiro, 30_000);
  const v = repartoMes({ sueldo: 0, otrosIngresos: 0, gastos: 0, ahorroPct: 20 });
  assert.equal(v.base, 0); assert.deepEqual(v.pct, { gastos: 0, ahorro: 0, saldo: 0 });
});
t("gastos por categoría con porcentajes", () => {
  const c = gastosPorCategoria([{ category: "Comida", amount: 30_000 }, { category: "Comida", amount: 20_000 }, { category: "Ocio", amount: 50_000 }], 500_000);
  assert.equal(c.length, 2); assert.equal(c[0].amount, 50_000);
  assert.equal(c[0].pctGastos, 50); assert.equal(c[0].pctBase, 10);
});
t("lectura del mes y variación", () => {
  const r = repartoMes({ sueldo: 1_000_000, otrosIngresos: 0, gastos: 600_000, ahorroPct: 10 });
  const l = lecturaDelMes(r, 10, 400_000);
  assert.ok(l[0].includes("60 %")); assert.ok(l.some((x) => x.includes("subieron 50 %")));
  assert.equal(variacion(120, 100), 20); assert.equal(variacion(5, 0), null);
});
process.exit(fails ? 1 : 0);
