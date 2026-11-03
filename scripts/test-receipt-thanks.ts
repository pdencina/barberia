// Bloque de agradecimiento del correo de la boleta. Uso: npx tsx scripts/test-receipt-thanks.ts
import assert from "node:assert/strict";
import { receiptThanksHtml } from "../src/lib/receipt-thanks";
import { armarEnlacesCorreo } from "../src/lib/post-service-links";
let fails = 0;
const t = (n: string, f: () => void) => { try { f(); console.log("OK  " + n); } catch (e: any) { fails++; console.log("MAL " + n + ": " + e.message); } };
const A = "https://www.re-booking.cl";

t("con Google Maps: el botón y las estrellas van a Google y se agenda en el link del negocio", () => {
  const h = receiptThanksHtml({ links: armarEnlacesCorreo(A, { google_maps_url: "https://maps.app.goo.gl/abc", slug: "levels" }, "tx1"), barberName: "Vicente", businessName: "Estudio Levels", accent: "#0F8B8D" });
  assert.ok(h.includes("Califícanos en Google Maps ★"));
  assert.equal((h.match(/https:\/\/maps\.app\.goo\.gl\/abc/g) || []).length, 6); // 5 estrellas + botón
  assert.ok(h.includes(`${A}/b/levels`) && h.includes("Vicente") && h.includes("Estudio Levels"));
});
t("sin Google Maps: califica en re-booking con el id de la venta", () => {
  const h = receiptThanksHtml({ links: armarEnlacesCorreo(A, { slug: "levels" }, "tx1"), barberName: "Vicente", accent: "#0F8B8D" });
  assert.ok(h.includes(`${A}/review/tx1`) && h.includes("Califica tu experiencia ★") && !h.includes("Google Maps"));
});
t("escapa el texto (nada de HTML inyectado por nombres)", () => {
  const h = receiptThanksHtml({ links: armarEnlacesCorreo(A, null, "tx1"), barberName: "<script>alert(1)</script>", businessName: "A&B \"x\"", accent: "#000" });
  assert.ok(!h.includes("<script>") && h.includes("&lt;script&gt;") && h.includes("A&amp;B"));
});
process.exit(fails ? 1 : 0);
