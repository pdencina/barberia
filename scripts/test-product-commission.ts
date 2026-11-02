import assert from "node:assert/strict";
import { isCosmeticCategory, productCommission, COSMETIC_COMMISSION_PER_UNIT } from "../src/lib/product-commission";

let fails = 0;
const t = (n: string, f: () => void) => { try { f(); console.log("OK  " + n); } catch (e: any) { fails++; console.log("FALLO " + n + ": " + e.message); } };

t("la comision de cosmeticos es $2.000", () => assert.equal(COSMETIC_COMMISSION_PER_UNIT, 2000));
t("«Cosméticos», «cosmeticos» y «COSMETICO» son cosmeticos", () => { for (const c of ["Cosméticos", "cosmeticos", "COSMETICO", " Cosméticos "]) assert.ok(isCosmeticCategory(c), c); });
t("consumibles, aseo, generales, sin categoria y otros NO son cosmeticos", () => { for (const c of ["Consumibles", "Aseo", "Generales", "curso barber", "", null, undefined]) assert.equal(isCosmeticCategory(c as any), false, String(c)); });
t("cosmetico: $2.000 por unidad", () => { assert.equal(productCommission({ category: "Cosméticos" }, 1, 17000), 2000); assert.equal(productCommission({ category: "Cosméticos" }, 3, 51000), 6000); });
t("consumible: nunca comision (aunque el producto tenga una regla)", () => { assert.equal(productCommission({ category: "Consumibles" }, 5, 10000), 0); assert.equal(productCommission({ category: "Consumibles", type: "fixed", value: 500 }, 5, 10000), 0); assert.equal(productCommission({ category: "Consumibles", type: "percent", value: 20 }, 5, 10000), 0); });
t("sin categoria o producto desconocido: nunca comision", () => { assert.equal(productCommission({ category: null }, 2, 30000), 0); assert.equal(productCommission(undefined, 2, 30000), 0); });
t("cosmetico con regla propia: se respeta (fijo y porcentaje)", () => { assert.equal(productCommission({ category: "Cosméticos", type: "fixed", value: 1500 }, 2, 34000), 3000); assert.equal(productCommission({ category: "Cosméticos", type: "percent", value: 10 }, 1, 17000), 1700); });
t("cosmetico con regla en 0 vuelve a $2.000", () => { assert.equal(productCommission({ category: "Cosméticos", type: "fixed", value: 0 }, 2, 34000), 4000); });
t("cantidad invalida cuenta como 1", () => { assert.equal(productCommission({ category: "Cosméticos" }, 0, 17000), 2000); });
process.exit(fails ? 1 : 0);
