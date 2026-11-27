import assert from "node:assert/strict";
import { etiquetasDe, resumirDia, textoResumen, type MensajeResumen } from "../src/lib/agente/resumen";
import { manejarAdmin } from "../src/lib/agente/admin";

async function main() {
  const ahora = Date.parse("2026-11-26T22:00:00Z"), dia = "2026-11-26";
  const m = (c: string, direccion: "entrante" | "saliente", texto: string, hora = "20:00", tipo = "texto"): MensajeResumen => ({ contact_hash: c, direccion, texto, tipo, created_at: `2026-11-26T${hora}:00Z` });
  const datos = [
    m("a", "saliente", "Hola Ana! Te escribimos desde Estudio Levels para confirmar", "18:00", "plantilla"), m("a", "entrante", "confirmo mi cita", "18:05", "boton"), m("a", "saliente", "Tu cita está confirmada.", "18:06"),
    m("b", "entrante", "[imagen]", "19:00", "imagen"), m("b", "saliente", "Recibí tu imagen 🙌 Una persona del equipo la revisa y te responde por aquí en un momento.", "19:01"),
    m("c", "entrante", "asdf qwer"), m("c", "saliente", "No entendí lo que me escribes. Por favor elige una de estas opciones:", "20:01", "lista"),
    m("d", "saliente", "Te contactará una persona.", "19:00"), m("d", "saliente", "[manual] Hola, ya te ayudo", "19:30"),
  ];
  const c = resumirDia(datos, new Set(), ahora, dia);
  assert.deepEqual(c, { conversaciones: 4, persona: 1, confuso: 1, confirmacion: 1, consulta: 2, confirmacionesEnviadas: 1, confirmadas: 1, canceladas: 0 });
  assert.deepEqual(etiquetasDe(datos.filter((x) => x.contact_hash === "d"), false, ahora, dia), []); // contestada a mano
  assert.ok(etiquetasDe([], true, ahora, dia).includes("persona"));
  // El resumen cuenta por día de Chile: a las 02:00 UTC todavía es el día anterior.
  assert.equal(resumirDia([{ ...datos[5], created_at: "2026-11-27T02:00:00Z" }], new Set(), ahora, dia).conversaciones, 1);
  const salud = { clientesNuevos: 2, reservasAgente: 1, mensajesFallidos: 0, enviosFallidos: 0, ultimoEntrante: null };
  assert.match(textoResumen(c, salud, true), /Sin fallas[\s\S]*Clientes nuevos: 2[\s\S]*Esperan a una persona: 1/);
  assert.match(textoResumen(c, { ...salud, enviosFallidos: 3 }, false), /3 envíos fallidos[\s\S]*apagado/);
  assert.equal(await manejarAdmin("Resumen", { resumen: async () => "R" } as any, ahora), "R");
  console.log("resumen del agente: OK");
}
main();
