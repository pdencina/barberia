// Frecuencia de visita por cliente. Uso: npx tsx scripts/test-frecuencia.ts
import assert from "node:assert/strict";
import { calcularFrecuencia, visitasParaMeta } from "../src/lib/frecuencia";
let fails = 0;
const t = (n: string, f: () => void) => { try { f(); console.log("OK  " + n); } catch (e: any) { fails++; console.log("MAL " + n + ": " + e.message); } };

const citas = (mes: string, reparto: Record<string, number>) =>
  Object.entries(reparto).flatMap(([c, n]) => Array.from({ length: n }, () => ({ client_id: c, date: `${mes}-10` })));

t("promedio = visitas / clientes distintos", () => {
  const r = calcularFrecuencia(citas("2026-10", { a: 2, b: 1, c: 1 }), "2026-11", 1);
  assert.equal(r.length, 1); assert.equal(r[0].visitas, 4); assert.equal(r[0].clientes, 3); assert.equal(r[0].promedio, 1.33);
  assert.equal(r[0].volvieron, 1); assert.equal(r[0].pctVolvieron, 33); assert.equal(r[0].parcial, false);
});
t("ignora citas sin cliente y marca el mes en curso como parcial", () => {
  const r = calcularFrecuencia([...citas("2026-11", { a: 1 }), { client_id: null, date: "2026-11-02" }], "2026-11", 1);
  assert.equal(r[0].visitas, 1); assert.equal(r[0].parcial, true);
});
t("parte desde el primer mes con flujo real y descarta los anteriores", () => {
  const todas = [...citas("2026-09", { a: 1, b: 1 }), ...citas("2026-10", Object.fromEntries(Array.from({ length: 60 }, (_, i) => ["c" + i, 1]))), ...citas("2026-11", { a: 1 })];
  const r = calcularFrecuencia(todas, "2026-11", 50);
  assert.deepEqual(r.map((f) => f.mes), ["2026-10", "2026-11"]);
});
t("sin ningún mes con flujo real devuelve vacío", () => assert.deepEqual(calcularFrecuencia(citas("2026-09", { a: 1 }), "2026-11", 50), []));
t("visitas que faltan para la meta", () => {
  const f = calcularFrecuencia(citas("2026-10", { a: 1, b: 1, c: 1, d: 1 }), "2026-11", 1)[0];
  assert.equal(visitasParaMeta(f, 2), 4); assert.equal(visitasParaMeta(f, 1.5), 2); assert.equal(visitasParaMeta(f, 1), 0);
});
process.exit(fails ? 1 : 0);
