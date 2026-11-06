// Teléfono del negocio en los correos. Uso: npx tsx scripts/test-contacto-negocio.ts
import assert from "node:assert/strict";
import { formatoTelefono, lineaContactoHtml } from "../src/lib/contacto-negocio";
let fails = 0;
const t = (n: string, f: () => void) => { try { f(); console.log("OK  " + n); } catch (e: any) { fails++; console.log("MAL " + n + ": " + e.message); } };
t("formatos chilenos", () => {
  assert.equal(formatoTelefono("+56942666172"), "9 4266 6172"); assert.equal(formatoTelefono("998950727"), "9 9895 0727"); assert.equal(formatoTelefono("56 9 9895 0727"), "9 9895 0727");
});
t("sin teléfono no hay línea; con teléfono lleva el del negocio y no uno fijo", () => {
  assert.equal(lineaContactoHtml("¿Dudas?", null), ""); assert.equal(lineaContactoHtml("¿Dudas?", "  "), ""); assert.equal(lineaContactoHtml("¿Dudas?", "123"), "");
  const l = lineaContactoHtml("¿Dudas?", "998950727");
  assert.ok(l.includes("9 9895 0727") && !l.includes("4266"));
});
t("no deja pasar HTML", () => assert.ok(!lineaContactoHtml("¿?", "+56 9 <b>1234</b> 5678").includes("<b>")));
process.exit(fails ? 1 : 0);
