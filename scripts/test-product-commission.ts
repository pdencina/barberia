import assert from "node:assert/strict";
import { isCosmeticCategory, productCommission } from "../src/lib/product-commission";
import { cosmeticAmountOn } from "../src/lib/cosmetic-amount";

let fails = 0;
const t = (n: string, f: () => void) => { try { f(); console.log("OK  " + n); } catch (e: any) { fails++; console.log("FALLO " + n + ": " + e.message); } };

t("sin monto del negocio (0) los cosmeticos no dan comision", () => { assert.equal(productCommission({ category: "Cosméticos" }, 2, 34000), 0); assert.equal(productCommission({ category: "Cosméticos" }, 2, 34000, 0), 0); });
t("«Cosméticos», «cosmeticos» y «COSMETICO» son cosmeticos", () => { for (const c of ["Cosméticos", "cosmeticos", "COSMETICO", " Cosméticos "]) assert.ok(isCosmeticCategory(c), c); });
t("consumibles, aseo, generales, sin categoria y otros NO son cosmeticos", () => { for (const c of ["Consumibles", "Aseo", "Generales", "curso barber", "", null, undefined]) assert.equal(isCosmeticCategory(c as any), false, String(c)); });
t("cosmetico: el monto del negocio por unidad", () => { assert.equal(productCommission({ category: "Cosméticos" }, 1, 17000, 2000), 2000); assert.equal(productCommission({ category: "Cosméticos" }, 3, 51000, 2000), 6000); assert.equal(productCommission({ category: "Cosméticos" }, 3, 51000, 1500), 4500); });
t("consumible: nunca comision (aunque el producto tenga una regla)", () => { assert.equal(productCommission({ category: "Consumibles" }, 5, 10000, 2000), 0); assert.equal(productCommission({ category: "Consumibles", type: "fixed", value: 500 }, 5, 10000, 2000), 0); assert.equal(productCommission({ category: "Consumibles", type: "percent", value: 20 }, 5, 10000, 2000), 0); });
t("sin categoria o producto desconocido: nunca comision", () => { assert.equal(productCommission({ category: null }, 2, 30000, 2000), 0); assert.equal(productCommission(undefined, 2, 30000, 2000), 0); });
t("cosmetico con regla propia: se respeta (fijo y porcentaje)", () => { assert.equal(productCommission({ category: "Cosméticos", type: "fixed", value: 1500 }, 2, 34000), 3000); assert.equal(productCommission({ category: "Cosméticos", type: "percent", value: 10 }, 1, 17000), 1700); });
t("cosmetico con regla en 0 usa el monto del negocio", () => { assert.equal(productCommission({ category: "Cosméticos", type: "fixed", value: 0 }, 2, 34000, 2000), 4000); });
t("cantidad invalida cuenta como 1", () => { assert.equal(productCommission({ category: "Cosméticos" }, 0, 17000, 2000), 2000); });
t("cosméticos desde una fecha (migración 127): octubre no cambia, noviembre sí; arriendo aparte", () => {
  const regla = { amount: 2000, from: "2026-11-01" };
  assert.equal(cosmeticAmountOn(regla, "2026-10-31T20:00:00Z"), 0);
  assert.equal(cosmeticAmountOn(regla, "2026-11-01T14:00:00Z"), 2000);
  assert.equal(cosmeticAmountOn(regla, "2026-11-01T02:00:00Z"), 0); // 02:00 UTC del 1 nov = 31 oct en Chile
  assert.equal(cosmeticAmountOn({ amount: 2000, from: null }, "2026-01-05T10:00:00Z"), 2000);
  assert.equal(cosmeticAmountOn({ amount: 0, from: null }, "2026-11-05T10:00:00Z"), 0);
});
process.exit(fails ? 1 : 0);

