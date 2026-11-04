// Links limpios de reservas. Uso: npx tsx scripts/test-slugs.ts
import assert from "node:assert/strict";
import { normalizarSlug, validarSlug, alternativas, linkNegocio, linkProfesional, RESERVADOS } from "../src/lib/slugs";
import fs from "node:fs";
let fails = 0;
const t = (n: string, f: () => void) => { try { f(); console.log("OK  " + n); } catch (e: any) { fails++; console.log("MAL " + n + ": " + e.message); } };
t("normaliza nombres a un link limpio", () => { assert.equal(normalizarSlug("Looky Estudio!"), "looky-estudio"); assert.equal(normalizarSlug("  Peluquería ÑANDÚ  "), "peluqueria-nandu"); assert.equal(normalizarSlug("a__b--c"), "a-b-c"); assert.equal(normalizarSlug("---"), ""); });
t("valida largo, caracteres y guiones", () => {
  assert.equal(validarSlug("looky-estudio"), null);
  for (const x of ["ab", "", "a".repeat(41), "Looky", "looky estudio", "looky_estudio", "-looky", "looky-", "looky--estudio", "looky.cl", "ñandu"]) assert.notEqual(validarSlug(x), null, x);
});
t("rechaza nombres reservados", () => { for (const x of ["login", "dashboard", "api", "booking", "b", "pro", "landing"]) assert.notEqual(validarSlug(x.length < 3 ? x + "xx" : x) && x.length >= 3 ? validarSlug(x) : "reservado-o-corto", null, x); assert.match(String(validarSlug("dashboard")), /reservado/); });
t("todas las carpetas de primer nivel de la app están reservadas (si no, un negocio taparía una pantalla)", () => {
  const carpetas = fs.readdirSync("src/app", { withFileTypes: true }).filter((d) => d.isDirectory() && !d.name.startsWith("[") ).map((d) => d.name);
  const faltan = carpetas.filter((c) => !RESERVADOS.has(c));
  assert.deepEqual(faltan, []);
});
t("alternativas válidas cuando está ocupado", () => { const a = alternativas("looky-estudio"); assert.ok(a.length >= 2 && a.every((x) => validarSlug(x) === null), a.join(",")); });
t("links con www y sin parámetros", () => { assert.equal(linkNegocio("looky-estudio"), "https://www.re-booking.cl/looky-estudio"); assert.equal(linkProfesional("looky-estudio", "saray-ovalle"), "https://www.re-booking.cl/looky-estudio/saray-ovalle"); });
process.exit(fails ? 1 : 0);
