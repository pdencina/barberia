import assert from "node:assert";
import { buscarVentaRepetida, citaTieneCobro, textoVentaRepetida } from "../src/lib/venta-segura";

// Base falsa mínima: cada .from() devuelve un constructor encadenable que resuelve a las filas dadas.
const fake = (tablas: Record<string, any[]>) => ({
  from: (t: string) => { const q: any = { then: (r: any) => r({ data: tablas[t] || [] }) }; for (const m of ["select", "eq", "gte", "lt", "order", "limit"]) q[m] = () => q; return q; },
});
(async () => {
  const ahora = new Date("2026-11-23T20:00:00Z");
  const r = await buscarVentaRepetida(fake({ transactions: [{ id: "t1", total: 18000, payment_method: "cash", created_at: "2026-11-23T19:55:00Z" }] }), { tenantId: "x", barberId: "b", clientId: "c", total: 18000, ahora });
  assert.equal(r?.hace_min, 5); assert.match(textoVentaRepetida(r!), /hace 5 min/);
  assert.equal(await buscarVentaRepetida(fake({ transactions: [] }), { tenantId: "x", barberId: "b", clientId: "c", total: 18000, ahora }), null);
  assert.equal(await buscarVentaRepetida(fake({ transactions: [{ id: "t1", total: 1, created_at: "2026-11-23T19:55:00Z" }] }), { tenantId: "x", barberId: "b", clientId: null, total: 18000, ahora }), null, "sin cliente no se compara");
  assert.equal(await citaTieneCobro(fake({ transactions: [{ id: "t" }] }), { id: "a", client_id: "c", date: "2026-11-23", tenant_id: "x" }), true);
  assert.equal(await citaTieneCobro(fake({ transactions: [] }), { id: "a", client_id: "c", date: "2026-11-23", tenant_id: "x" }), false);
  console.log("ok venta-segura");
})();
