// Link directo de reseña de Google. Uso: npx tsx scripts/test-google-review.ts
import assert from "node:assert/strict";
import { parsePlaceId, googleReviewUrl } from "../src/lib/google-review";
import { armarEnlacesCorreo } from "../src/lib/post-service-links";
let fails = 0;
const t = (n: string, f: () => void) => { try { f(); console.log("OK  " + n); } catch (e: any) { fails++; console.log("MAL " + n + ": " + e.message); } };
const ID = "ChIJ948lWWLXYpYR6bpnhklVCkU";
const A = "https://www.re-booking.cl";

t("acepta el ID suelto, con espacios", () => { assert.equal(parsePlaceId(ID), ID); assert.equal(parsePlaceId(`  ${ID}  `), ID); });
t("saca el ID de un link de reseñas completo o con place_id", () => {
  assert.equal(parsePlaceId(`https://search.google.com/local/writereview?placeid=${ID}`), ID);
  assert.equal(parsePlaceId(`https://www.google.com/maps/place/?q=place_id:${ID}&place_id=${ID}&x=1`), ID);
});
t("rechaza lo que no es un ID", () => { for (const x of ["", "hola", "https://maps.app.goo.gl/abc", "ChIJ short", "<script>", "a".repeat(300)]) assert.equal(parsePlaceId(x), null, x); });
t("arma el link directo", () => { assert.equal(googleReviewUrl(ID), `https://search.google.com/local/writereview?placeid=${ID}`); assert.equal(googleReviewUrl(""), null); assert.equal(googleReviewUrl("xx"), null); });
t("el correo prefiere el link directo sobre el de Maps y sobre la página interna", () => {
  const conTodo = armarEnlacesCorreo(A, { google_place_id: ID, google_maps_url: "https://maps.app.goo.gl/abc", slug: "levels" }, "tx1");
  assert.equal(conTodo.reviewUrl, `https://search.google.com/local/writereview?placeid=${ID}`);
  assert.equal(conTodo.reviewLabel, "Califícanos en Google Maps ★");
  assert.equal(armarEnlacesCorreo(A, { google_place_id: "", google_maps_url: "https://maps.app.goo.gl/abc" }, "tx1").reviewUrl, "https://maps.app.goo.gl/abc");
  assert.equal(armarEnlacesCorreo(A, { google_place_id: "basura" }, "tx1").reviewUrl, `${A}/review/tx1`);
});
process.exit(fails ? 1 : 0);
