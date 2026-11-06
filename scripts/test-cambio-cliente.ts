// Plazo para cancelar/modificar desde el correo. Uso: npx tsx scripts/test-cambio-cliente.ts
import assert from "node:assert/strict";
import { plazoValido, textoPlazo, fraseCorreoPlazo, horasHasta, aunSePuedeCambiar, PLAZOS_RAPIDOS } from "../src/lib/cambio-cliente";
let fails = 0;
const t = (n: string, f: () => void) => { try { f(); console.log("OK  " + n); } catch (e: any) { fails++; console.log("MAL " + n + ": " + e.message); } };

t("plazos válidos: enteros 0 a 720", () => {
  assert.equal(plazoValido(6), 6); assert.equal(plazoValido("12"), 12); assert.equal(plazoValido(0), 0);
  assert.equal(plazoValido(-1), null); assert.equal(plazoValido(1.5), null); assert.equal(plazoValido(721), null); assert.equal(plazoValido("abc"), null); assert.equal(plazoValido(null), null); assert.equal(plazoValido(""), null);
});
t("texto del plazo", () => {
  assert.equal(textoPlazo(1), "1 hora"); assert.equal(textoPlazo(3), "3 horas"); assert.equal(textoPlazo(24), "1 día"); assert.equal(textoPlazo(48), "2 días"); assert.equal(textoPlazo(36), "1 día y 12 horas");
  assert.equal(fraseCorreoPlazo(6), "Puedes cancelar o modificar tu cita hasta 6 horas antes de la hora.");
  assert.deepEqual(PLAZOS_RAPIDOS, [1, 3, 6, 12, 24, 48]);
});
t("se compara en hora de pared de Chile", () => {
  const ahora = new Date("2026-11-06T14:00:00Z");          // 14:00 de pared
  assert.equal(horasHasta("2026-11-06T18:00:00", ahora), 4);
  assert.equal(aunSePuedeCambiar("2026-11-06T18:00:00", ahora, 3), true);
  assert.equal(aunSePuedeCambiar("2026-11-06T18:00:00", ahora, 6), false);
  assert.equal(aunSePuedeCambiar("2026-11-06T17:00:00", ahora, 3), true);   // justo en el límite
});
process.exit(fails ? 1 : 0);
