// Códigos del descuento por planilla (corto y de pistola). Uso: npx tsx scripts/test-planilla-codigo.ts
import assert from "node:assert/strict";
import { makeShortCode, makeScanCode, leerCodigoPlanilla, pareceCodigoPlanilla, resumenLineas } from "../src/lib/planilla-codigo";
let fails = 0;
const t = (n: string, f: () => void) => { try { f(); console.log("OK  " + n); } catch (e: any) { fails++; console.log("MAL " + n + ": " + e.message); } };

t("código corto de 4 caracteres sin letras que se confunden", () => { for (let i = 0; i < 200; i++) { const c = makeShortCode(); assert.match(c, /^[A-HJ-NP-Z2-9]{4}$/); } });
t("código largo: PL- y 10 caracteres", () => { for (let i = 0; i < 200; i++) assert.match(makeScanCode(), /^PL-[A-HJ-NP-Z2-9]{10}$/); });
t("los códigos no se repiten en una tanda", () => { const s = new Set(Array.from({ length: 500 }, makeScanCode)); assert.equal(s.size, 500); });
t("lee el corto (4), el antiguo (6) y el de pistola, con minúsculas y espacios", () => {
  assert.deepEqual(leerCodigoPlanilla(" k7m2 "), { tipo: "corto", code: "K7M2" });
  assert.deepEqual(leerCodigoPlanilla("ABC234"), { tipo: "corto", code: "ABC234" });
  assert.deepEqual(leerCodigoPlanilla("pl-abcdefgh23"), { tipo: "escaneo", code: "PL-ABCDEFGH23" });
  assert.deepEqual(leerCodigoPlanilla("PLABCDEFGH23"), { tipo: "escaneo", code: "PL-ABCDEFGH23" });
});
t("rechaza lo que no es un código", () => { for (const x of ["", "AB", "ABCDE", "ABCDEFG", "PL-ABC", "hola mundo", "7801234567890"]) assert.equal(leerCodigoPlanilla(x), null, x); });
t("el Punto de Venta distingue el código de pistola de un código de producto", () => { assert.ok(pareceCodigoPlanilla("PL-ABCDEFGH23")); assert.ok(pareceCodigoPlanilla(" pl-abcdefgh23 ")); assert.ok(!pareceCodigoPlanilla("7801234567890")); assert.ok(!pareceCodigoPlanilla("ABCD")); });
t("resumen de productos", () => { assert.equal(resumenLineas([{ product_name: "Cera", quantity: 2 }, { name: "Shampoo", quantity: 1 }]), "Cera x2, Shampoo x1"); });
process.exit(fails ? 1 : 0);
