// Abono al reservar con la cuenta del negocio. Uso: npx tsx scripts/test-abono.ts
import assert from "node:assert/strict";
process.env.SECRET_BOX_KEY = Buffer.alloc(32, 7).toString("base64");
process.env.SUPABASE_SERVICE_ROLE_KEY = "clave-de-prueba";
import { calcularAbono, firmarNegocio, firmaValida, cargarCredencialAbono } from "../src/lib/deposit";
import { encryptSecret } from "../src/lib/secret-box";

let fails = 0;
const t = (n: string, f: () => void | Promise<void>) => Promise.resolve().then(f).then(() => console.log("OK  " + n), (e: any) => { fails++; console.log("MAL " + n + ": " + e.message); });

(async () => {
  await t("porcentaje: 30% de $35.000 = $10.500 y redondea hacia arriba", () => { assert.equal(calcularAbono(35000, { mode: "percent", percent: 30, fixed: null }), 10500); assert.equal(calcularAbono(10001, { mode: "percent", percent: 30, fixed: null }), 3001); });
  await t("monto fijo: $5.000, sin pasar del total", () => { assert.equal(calcularAbono(35000, { mode: "fixed", percent: 30, fixed: 5000 }), 5000); assert.equal(calcularAbono(3000, { mode: "fixed", percent: 30, fixed: 5000 }), 3000); });
  await t("mínimo del negocio", () => { assert.equal(calcularAbono(10000, { mode: "percent", percent: 10, fixed: null, minAmount: 2000 }), 2000); assert.equal(calcularAbono(1500, { mode: "percent", percent: 10, fixed: null, minAmount: 2000 }), 1500); });
  await t("valores raros no rompen: total 0, porcentaje fuera de rango, monto fijo vacío", () => {
    assert.equal(calcularAbono(0, { mode: "percent", percent: 30, fixed: null }), 0);
    assert.equal(calcularAbono(10000, { mode: "percent", percent: 500, fixed: null }), 10000);
    assert.equal(calcularAbono(10000, { mode: "fixed", percent: 30, fixed: null }), 0);
    assert.equal(calcularAbono(-5, { mode: "percent", percent: 30, fixed: null }), 0);
  });
  await t("firma del aviso: vale para su negocio y no para otro ni vacía", () => {
    const s = firmarNegocio("tenant-1");
    assert.ok(firmaValida("tenant-1", s)); assert.ok(!firmaValida("tenant-2", s)); assert.ok(!firmaValida("tenant-1", "x".repeat(32))); assert.ok(!firmaValida(null, s)); assert.ok(!firmaValida("tenant-1", ""));
  });
  const fake = (row: any) => ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: row, error: null }) }) }) }) });
  await t("credencial: usa el token propio (cifrado) y, si no hay, el del terminal", async () => {
    const enc = encryptSecret("APP_USR-propio-1234567890abcdef");
    assert.equal((await cargarCredencialAbono(fake({ mp_online_access_token: enc, mp_access_token: "APP_USR-terminal" }), "t")).token, "APP_USR-propio-1234567890abcdef");
    assert.deepEqual(await cargarCredencialAbono(fake({ mp_online_access_token: null, mp_access_token: "APP_USR-terminal" }), "t"), { token: "APP_USR-terminal", origen: "terminal" });
    assert.deepEqual(await cargarCredencialAbono(fake(null), "t"), { token: null, origen: null });
  });
  await t("un token propio alterado no se usa (cae al del terminal)", async () => {
    const r = await cargarCredencialAbono(fake({ mp_online_access_token: "abc.def.ghi", mp_access_token: "APP_USR-terminal" }), "t");
    assert.equal(r.origen, "terminal");
  });
  process.exit(fails ? 1 : 0);
})();
