// Prueba de la invitación a reservar al final de las respuestas informativas. Sin red, base ni llaves.
import assert from "node:assert/strict";
import { conLlamadaAReservar, TEXTO_CTA } from "../src/lib/agente/cta";

const L = "https://sintetico.invalid/b/negocio";
assert.equal(conLlamadaAReservar("Sí, atendemos los domingos.", L), `Sí, atendemos los domingos.\n\n${TEXTO_CTA}\n${L}`);
assert.equal(conLlamadaAReservar("Reserva en " + L + " y elige tu profesional.", L), "Reserva en " + L + " y elige tu profesional.", "ya trae el enlace");
assert.equal(conLlamadaAReservar("Las cancelaciones deben hacerse con 24 horas.", L), "Las cancelaciones deben hacerse con 24 horas.", "cancelar no invita a agendar");
assert.equal(conLlamadaAReservar("Te contactará una persona.", L), "Te contactará una persona.", "traspaso sin invitación");
for (const sin of [null, undefined, "", "   ", "http://inseguro.invalid/x", "javascript:alert(1)", "no es un enlace", "https://a.invalid/x y más"]) {
  assert.equal(conLlamadaAReservar("Respuesta.", sin as any), "Respuesta.", `sin enlace válido: ${String(sin)}`);
}
console.log("OK cta: invitación a reservar solo con enlace https válido, sin repetir ni en cancelaciones ni en traspasos.");
