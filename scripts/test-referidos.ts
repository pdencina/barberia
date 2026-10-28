import assert from "node:assert/strict";
import { nuevoCodigo } from "../src/lib/referidos-servidor";
import { codigoValido, normalizarCodigo, esAutoReferido, urlInvitacion } from "../src/lib/referidos";

let fails = 0;
const t = (n: string, f: () => void) => { try { f(); console.log("OK  " + n); } catch (e: any) { fails++; console.log("FALLO " + n + ": " + e.message); } };

t("los codigos generados son validos y de 6 caracteres", () => { for (let i = 0; i < 500; i++) { const c = nuevoCodigo(); assert.equal(c.length, 6); assert.ok(codigoValido(c)); } });
t("500 codigos no se repiten entre si (colisiones raras)", () => { assert.equal(new Set(Array.from({ length: 500 }, nuevoCodigo)).size, 500); });
t("codigos con 0, O, 1, I o largo distinto no son validos", () => { for (const c of ["ABC0EF", "ABCOEF", "ABC1EF", "ABCIEF", "ABCDE", "ABCDEFG", "", null, 42]) assert.equal(codigoValido(c as any), false); });
t("normaliza espacios y minusculas", () => { assert.equal(normalizarCodigo("  k7m2xq "), "K7M2XQ"); assert.ok(codigoValido("k7m2xq")); });
t("auto-referido: mismo correo (sin importar mayusculas)", () => { assert.equal(esAutoReferido({ adminEmails: ["Dueno@Mail.cl"], rut: null }, { email: " dueno@mail.cl ", rut: null }), true); });
t("auto-referido: mismo RUT con distinto formato", () => { assert.equal(esAutoReferido({ adminEmails: ["a@a.cl"], rut: "76.123.456-7" }, { email: "otro@b.cl", rut: "761234567" }), true); });
t("otro correo y otro RUT: permitido", () => { assert.equal(esAutoReferido({ adminEmails: ["a@a.cl"], rut: "76.123.456-7" }, { email: "otro@b.cl", rut: "77.000.000-1" }), false); });
t("sin RUT en ninguno no cuenta como mismo RUT", () => { assert.equal(esAutoReferido({ adminEmails: ["a@a.cl"], rut: null }, { email: "otro@b.cl", rut: null }), false); });
t("enlace de invitacion", () => { assert.equal(urlInvitacion("https://www.re-booking.cl/", "ABC234"), "https://www.re-booking.cl/suscribirse?ref=ABC234"); });
process.exit(fails ? 1 : 0);
