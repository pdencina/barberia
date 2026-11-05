// Volver de Mercado Pago al link del negocio. Uso: npx tsx scripts/test-volver-reserva.ts
import assert from "node:assert/strict";
import { enlaceDeVuelta } from "../src/lib/volver-reserva";
let fails = 0;
const t = (n: string, f: () => void) => { try { f(); console.log("OK  " + n); } catch (e: any) { fails++; console.log("MAL " + n + ": " + e.message); } };
const U = "0ef8674e-186b-41d5-aabb-256bfcaffeb5";
t("vuelve al link limpio del negocio y del profesional", () => { assert.deepEqual(enlaceDeVuelta(`?n=looky-estudio&p=saray-ovalle&r=${U}&collection_id=null&status=null`), { href: "/looky-estudio/saray-ovalle", ref: U }); });
t("solo el negocio", () => { assert.equal(enlaceDeVuelta("?n=looky-estudio").href, "/looky-estudio"); });
t("sin datos vuelve a /booking", () => { assert.deepEqual(enlaceDeVuelta(""), { href: "/booking", ref: null }); });
t("no arma links con texto raro (nada de //evil.com, javascript:, rutas)", () => { for (const n of ["//evil.com", "https://evil.cl", "javascript:alert(1)", "../admin", "a/b", "LOOKY", "ab", "-x-"]) assert.equal(enlaceDeVuelta(`?n=${encodeURIComponent(n)}`).href, "/booking", n); });
t("el profesional se ignora sin negocio o si es inválido", () => { assert.equal(enlaceDeVuelta("?p=saray-ovalle").href, "/booking"); assert.equal(enlaceDeVuelta("?n=looky-estudio&p=../x").href, "/looky-estudio"); });
t("una referencia que no es UUID se descarta", () => { assert.equal(enlaceDeVuelta("?n=looky-estudio&r=1;drop").ref, null); });
process.exit(fails ? 1 : 0);
