// Reseñas destacadas de la página de reservas. Uso: npx tsx scripts/test-resenas-destacadas.ts
import assert from "node:assert/strict";
import { elegirDestacadas, intercalar, nombreCorto } from "../src/lib/resenas-destacadas";
let fails = 0;
const t = (n: string, f: () => void) => { try { f(); console.log("OK  " + n); } catch (e: any) { fails++; console.log("MAL " + n + ": " + e.message); } };
t("nombre corto no publica el apellido completo", () => { assert.equal(nombreCorto("juan PÉREZ gonzalez"), "Juan P."); assert.equal(nombreCorto("Ana"), "Ana"); assert.equal(nombreCorto(null), "Cliente"); });
t("solo 4-5 estrellas con comentario largo; primero las de 5 y más nuevas", () => {
  const r = elegirDestacadas([
    { rating: 5, comment: "Excelente atención, muy puntuales", created_at: "2026-10-01", cliente: "Luis Soto" },
    { rating: 5, comment: "Muy buen corte y buen ambiente", created_at: "2026-11-01", cliente: "Pedro Rojo" },
    { rating: 4, comment: "Buen servicio en general, volveré", created_at: "2026-11-02", cliente: null },
    { rating: 5, comment: "ok", created_at: "2026-11-03", cliente: "X" },
    { rating: 3, comment: "Regular, esperé bastante rato", created_at: "2026-11-03", cliente: "Y" },
    { rating: 5, comment: null, created_at: "2026-11-03", cliente: "Z" },
  ]);
  assert.deepEqual(r.map((x) => x.autor), ["Pedro R.", "Luis S.", "Cliente"]);
});
t("intercala Google y re-booking y respeta el máximo", () => {
  const g = ["g1", "g2", "g3"].map((a) => ({ rating: 5, texto: "x", autor: a, origen: "google" as const }));
  const b = ["b1", "b2"].map((a) => ({ rating: 5, texto: "x", autor: a, origen: "rebooking" as const }));
  assert.deepEqual(intercalar(g, b).map((x) => x.autor), ["g1", "b1", "g2", "b2", "g3"]);
  assert.equal(intercalar(g, b, 3).length, 3);
});
process.exit(fails ? 1 : 0);
