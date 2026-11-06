// Frecuencia de visita por cliente. Uso: npx tsx scripts/test-frecuencia.ts
import assert from "node:assert/strict";
import { calcularFrecuencia, visitasParaMeta, promedioHastaDia, mesAnteriorDe, diasDelMes } from "../src/lib/frecuencia";
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
t("comparar con el mes anterior solo hasta el mismo día", () => {
  const cs = [
    { client_id: "a", date: "2026-10-03" }, { client_id: "a", date: "2026-10-20" }, { client_id: "b", date: "2026-10-05" }, { client_id: "c", date: "2026-10-28" },
  ];
  const r = promedioHastaDia(cs, "2026-10", 6);                 // hasta el 6: a(1) y b(1)
  assert.deepEqual([r.visitas, r.clientes, r.promedio], [2, 2, 1]);
  const t2 = promedioHastaDia(cs, "2026-10", 31);               // mes completo: a(2), b, c
  assert.deepEqual([t2.visitas, t2.clientes, t2.promedio], [4, 3, 1.33]);
  assert.equal(promedioHastaDia([], "2026-10", 6).promedio, 0);
});
t("mes anterior y días del mes", () => {
  assert.equal(mesAnteriorDe("2026-11"), "2026-10"); assert.equal(mesAnteriorDe("2026-01"), "2025-12");
  assert.equal(diasDelMes("2026-02"), 28); assert.equal(diasDelMes("2026-10"), 31);
});
process.exit(fails ? 1 : 0);
