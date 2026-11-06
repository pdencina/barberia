// Servicios internos (extras de 0 minutos). Uso: npx tsx scripts/test-servicios-internos.ts
import assert from "node:assert/strict";
import { errorDuracion, esInterno, leerServiciosPublicos } from "../src/lib/servicios-internos";
let fails = 0;
const t = async (n: string, f: () => void | Promise<void>) => { try { await f(); console.log("OK  " + n); } catch (e: any) { fails++; console.log("MAL " + n + ": " + e.message); } };

(async () => {
  await t("un servicio público necesita al menos 5 minutos; uno interno puede durar 0", () => {
    assert.equal(errorDuracion(0, true), null);
    assert.equal(errorDuracion(15, true), null);
    assert.ok(errorDuracion(0, false)?.includes("al menos 5"));
    assert.ok(errorDuracion(4, false)?.includes("interno"));
    assert.equal(errorDuracion(5, false), null);
    assert.equal(errorDuracion(45, false), null);
  });
  await t("duraciones no válidas", () => {
    assert.ok(errorDuracion(-1, true));
    assert.ok(errorDuracion(2.5, true));
    assert.ok(errorDuracion("abc", true));
    assert.ok(errorDuracion(5000, true));
    assert.equal(esInterno({ internal_only: true }), true); assert.equal(esInterno({}), false); assert.equal(esInterno({ internal_only: null }), false);
  });
  await t("lectura pública: los internos no salen", async () => {
    const r = await leerServiciosPublicos(async () => ({ data: [{ id: "1", name: "Corte", internal_only: false }, { id: "2", name: "Diseño", internal_only: true }], error: null }), "id, name");
    assert.deepEqual(r.data, [{ id: "1", name: "Corte" }]);
  });
  await t("sin la migración 141 (la columna no existe) todos son públicos y no se rompe", async () => {
    let llamadas = 0;
    const r = await leerServiciosPublicos(async (cols) => { llamadas++; return cols.includes("internal_only") ? { data: null, error: { message: "column services.internal_only does not exist" } } : { data: [{ id: "1", name: "Corte" }], error: null }; }, "id, name");
    assert.equal(llamadas, 2); assert.deepEqual(r.data, [{ id: "1", name: "Corte" }]);
  });
  process.exit(fails ? 1 : 0);
})();
