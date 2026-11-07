// Resumen de clientes en la lista. Uso: npx tsx scripts/test-clientes-stats.ts
import assert from "node:assert/strict";
import { calcularStats, ordenarClientes, esOrdenCliente, statsVacias } from "../src/lib/clientes-stats";
let fails = 0;
const t = (n: string, f: () => void) => { try { f(); console.log("OK  " + n); } catch (e: any) { fails++; console.log("MAL " + n + ": " + e.message); } };

const citas = [
  { client_id: "a", status: "completed" }, { client_id: "a", status: "completed" }, { client_id: "a", status: "no_show" },
  { client_id: "a", status: "cancelled", cancel_reason: "profesional" },     // culpa del equipo: no baja la asistencia
  { client_id: "b", status: "completed" }, { client_id: "b", status: "cancelled", cancel_reason: "imprevisto" },
  { client_id: "c", status: "scheduled" },
];
const ventas = [{ client_id: "a", total: 20000 }, { client_id: "a", total: 10000 }, { client_id: "b", total: 40000 }, { client_id: "d", total: 15000 }];

t("visitas, asistencia, gastado y ticket", () => {
  const s = calcularStats(citas, ventas);
  assert.deepEqual(s.get("a"), { visitas: 2, ventas: 2, gastado: 30000, ticket: 15000, asistencia: 67 });   // 2 de 3 (la del equipo no cuenta)
  assert.deepEqual(s.get("b"), { visitas: 1, ventas: 1, gastado: 40000, ticket: 40000, asistencia: 50 });
});
t("una venta sin cita cuenta como visita y no tiene asistencia", () => assert.deepEqual(calcularStats(citas, ventas).get("d"), { visitas: 1, ventas: 1, gastado: 15000, ticket: 15000, asistencia: null }));
t("cita futura no cuenta; cliente sin nada usa valores vacíos", () => { assert.equal(calcularStats(citas, ventas).has("c"), false); assert.equal(statsVacias().visitas, 0); });
t("ordenar por total gastado, ticket, asistencia y visitas, en los dos sentidos", () => {
  const l = [{ id: "a", name: "Ana" }, { id: "b", name: "Beto" }, { id: "c", name: "Cami" }, { id: "d", name: "Dani" }];
  const s = calcularStats(citas, ventas);
  assert.deepEqual(ordenarClientes(l, s, "gastado", false).map((x) => x.id), ["b", "a", "d", "c"]);
  assert.deepEqual(ordenarClientes(l, s, "gastado", true).map((x) => x.id), ["c", "d", "a", "b"]);
  assert.deepEqual(ordenarClientes(l, s, "ticket", false).map((x) => x.id), ["b", "a", "d", "c"]);      // sin ticket (c) al final
  assert.deepEqual(ordenarClientes(l, s, "ticket", true).map((x) => x.id), ["a", "d", "b", "c"]);
  assert.deepEqual(ordenarClientes(l, s, "asistencia", false).map((x) => x.id), ["a", "b", "c", "d"]);   // sin dato (c, d) al final por nombre
  assert.deepEqual(ordenarClientes(l, s, "visitas", false).map((x) => x.id), ["a", "b", "d", "c"]);
  assert.deepEqual(ordenarClientes(l, s, "nombre", false).map((x) => x.id), ["d", "c", "b", "a"]);
});
t("solo criterios conocidos", () => { assert.ok(esOrdenCliente("gastado")); assert.ok(!esOrdenCliente("x")); });
process.exit(fails ? 1 : 0);
