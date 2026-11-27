import assert from "node:assert/strict";
import { avisarDueno, conRespaldo, preguntaParaPlantilla, ventanaAbierta } from "../src/lib/agente/aviso-dueno";

async function main() {
  const ahora = Date.parse("2026-11-26T22:36:00Z");
  assert.equal(ventanaAbierta("2026-11-25T21:36:00Z", ahora), false); // 25 h: el caso que no llegó
  assert.equal(ventanaAbierta("2026-11-26T10:00:00Z", ahora), true);
  assert.equal(ventanaAbierta(null, ahora), false);
  const normal = async () => ({ estado: "aceptado" as const, id: "n" });
  const ok = async () => ({ estado: "aceptado" as const, id: "p" });
  assert.equal((await avisarDueno(true, { normal, plantilla: ok })).porPlantilla, false);
  assert.equal((await avisarDueno(false, { normal, plantilla: ok })).porPlantilla, true);
  assert.equal((await avisarDueno(false, { normal, plantilla: async () => ({ estado: "fallido" }) })).porPlantilla, false);
  assert.equal((await avisarDueno(false, { normal, plantilla: async () => ({ estado: "incierto" }) })).porPlantilla, true); // no duplicar
  assert.equal(preguntaParaPlantilla("hola\n\ntienen   estacionamiento?", false), "hola tienen estacionamiento?");
  assert.match(preguntaParaPlantilla("imagen", true), /consultas/);
  assert.deepEqual(await conRespaldo(async () => ({ estado: "fallido" }), ok), { estado: "aceptado", id: "p" });
  assert.deepEqual(await conRespaldo(normal, ok), { estado: "aceptado", id: "n" });
  console.log("aviso al dueño: OK");
}
main();
