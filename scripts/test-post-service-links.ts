// Enlaces del correo de agradecimiento. Uso: npx tsx scripts/test-post-service-links.ts
import assert from "node:assert/strict";
import { armarEnlacesCorreo } from "../src/lib/post-service-links";
const A = "https://www.re-booking.cl";
let fails = 0;
const t = (n: string, f: () => void) => { try { f(); console.log("OK  " + n); } catch (e: any) { fails++; console.log("MAL " + n + ": " + e.message); } };
t("con link de Google Maps: califica ahí", () => { const l = armarEnlacesCorreo(A, { google_maps_url: "https://maps.app.goo.gl/abc", slug: "levels" }, "c1"); assert.equal(l.reviewUrl, "https://maps.app.goo.gl/abc"); assert.equal(l.reviewLabel, "Califícanos en Google Maps ★"); assert.match(l.subject, /Google Maps/); });
t("sin link de Google: página interna", () => { const l = armarEnlacesCorreo(A, { google_maps_url: "", slug: "levels" }, "c1"); assert.equal(l.reviewUrl, `${A}/review/c1`); assert.equal(l.reviewLabel, "Califica tu experiencia ★"); });
t("un valor que no es una dirección web no se usa", () => { for (const v of ["javascript:alert(1)", "hola", "ftp://x.cl"]) assert.equal(armarEnlacesCorreo(A, { google_maps_url: v }, "c1").reviewUrl, `${A}/review/c1`, v); });
t("agendar va al link de reserva del negocio, o a /booking si no tiene", () => { assert.equal(armarEnlacesCorreo(A, { slug: "levels" }, "c1").bookUrl, `${A}/b/levels`); assert.equal(armarEnlacesCorreo(A, null, "c1").bookUrl, `${A}/booking`); });
process.exit(fails ? 1 : 0);
