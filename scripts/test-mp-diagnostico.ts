// Resumen de la cuenta de Mercado Pago para cobrar online. Uso: npx tsx scripts/test-mp-diagnostico.ts
import assert from "node:assert/strict";
import { resumirCuenta } from "../src/lib/mp-diagnostico";
let fails = 0;
const t = (n: string, f: () => void) => { try { f(); console.log("OK  " + n); } catch (e: any) { fails++; console.log("MAL " + n + ": " + e.message); } };
t("cuenta sana de producción: sin problemas", () => { const r = resumirCuenta("APP_USR-abc", { site_id: "MLC", user_type: "normal", status: { sell: { allow: true } }, tags: [] }); assert.equal(r.tokenTipo, "produccion"); assert.equal(r.puedeVender, true); assert.deepEqual(r.problemas, []); });
t("token de prueba se avisa", () => { const r = resumirCuenta("TEST-123", { site_id: "MLC" }); assert.equal(r.tokenTipo, "prueba"); assert.ok(r.problemas.some((p) => /PRUEBA/.test(p))); });
t("cuenta que no puede vender se avisa con sus códigos", () => { const r = resumirCuenta("APP_USR-abc", { site_id: "MLC", status: { sell: { allow: false, codes: ["identity_validation_required"] } } }); assert.equal(r.puedeVender, false); assert.ok(r.problemas.some((p) => /NO puede recibir pagos/.test(p) && /identity_validation_required/.test(p))); });
t("otro país se avisa", () => { assert.ok(resumirCuenta("APP_USR-abc", { site_id: "MLA" }).problemas.some((p) => /MLA/.test(p))); });
t("datos que no vienen no se inventan", () => { const r = resumirCuenta("APP_USR-abc", {}); assert.equal(r.puedeVender, null); assert.deepEqual(r.problemas, []); });
process.exit(fails ? 1 : 0);
