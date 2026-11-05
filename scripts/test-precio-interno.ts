// Precio interno de un producto (descuento por planilla). Uso: npx tsx scripts/test-precio-interno.ts
import assert from "node:assert/strict";
import { precioInterno, normalizarPrecioInterno } from "../src/lib/precio-interno";
let fails = 0;
const t = (n: string, f: () => void) => { try { f(); console.log("OK  " + n); } catch (e: any) { fails++; console.log("MAL " + n + ": " + e.message); } };

t("sin precio interno se descuenta el precio de venta", () => {
  assert.equal(precioInterno({ price: 18000 }), 18000);
  assert.equal(precioInterno({ price: "18000", internal_price: null }), 18000);
  assert.equal(precioInterno({ price: 18000, internal_price: undefined }), 18000);
  assert.equal(precioInterno({ price: 18000, internal_price: "" }), 18000);
});
t("con precio interno se descuenta ese monto (también 0 y más caro)", () => {
  assert.equal(precioInterno({ price: 18000, internal_price: 12000 }), 12000);
  assert.equal(precioInterno({ price: 18000, internal_price: "12500.40" }), 12500);
  assert.equal(precioInterno({ price: 18000, internal_price: 0 }), 0);
  assert.equal(precioInterno({ price: 18000, internal_price: 25000 }), 25000);
});
t("valores raros no rompen el descuento", () => {
  assert.equal(precioInterno({ price: 18000, internal_price: "abc" }), 18000);
  assert.equal(precioInterno({ price: 18000, internal_price: -5 }), 18000);
  assert.equal(precioInterno({ price: null }), 0);
});
t("normalizar lo que llega del formulario", () => {
  assert.equal(normalizarPrecioInterno(""), null);
  assert.equal(normalizarPrecioInterno(null), null);
  assert.equal(normalizarPrecioInterno(undefined), null);
  assert.equal(normalizarPrecioInterno("12000"), 12000);
  assert.equal(normalizarPrecioInterno(0), 0);
  assert.equal(normalizarPrecioInterno(-1), undefined);
  assert.equal(normalizarPrecioInterno("x"), undefined);
  assert.equal(normalizarPrecioInterno(1e12), undefined);
});
process.exit(fails ? 1 : 0);
