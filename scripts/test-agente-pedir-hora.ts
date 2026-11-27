import assert from "node:assert/strict";
import { esPedidoGeneral, preguntaPreferencia, consultaDePreferencia } from "../src/lib/agente/pedir-hora";
import { responderDisponibilidad } from "../src/lib/agente/disponibilidad";

async function main() {
  const datos: any = { negocio: { linkReserva: "https://x.invalid/r" }, horario: [], servicios: [], sucursales: [], profesionales: [{ id: "1", nombre: "Javier García", duracionMin: 45, link: "https://x.invalid/j" }, { id: "2", nombre: "Pablo Yañez", duracionMin: 45, link: "https://x.invalid/p" }] };
  for (const t of ["Hola, quiero reservar una hora", "quiero agendar", "Buenas tardes, necesito una hora porfa", "quisiera sacar hora", "agendar", "como reservo"]) assert.ok(esPedidoGeneral(t), t);
  for (const t of ["quiero reservar a las 15:00", "quiero agendar con Javier", "quiero reservar rizos", "necesito una hora para mañana", "hola", "ya reservé una hora"]) assert.ok(!esPedidoGeneral(t), t);
  assert.match(preguntaPreferencia(datos)!, /preferencia de profesional[\s\S]*Javier García[\s\S]*primero disponible[\s\S]*x\.invalid\/r/);
  const deps: any = { ahora: () => Date.parse("2026-11-27T13:00:00Z"), horasLibres: async (_: string, f: string) => ({ slots: [`${f}T16:00`, `${f}T18:00`], cerrado: false, fueraDeVentana: false }) };
  for (const [t, esperado] of [["Javier", /Javier/], ["con pablo", /Pablo/], ["primero disponible", /primera hora libre|disponible/i], ["el primero que esté disponible", /disponible/i], ["me da lo mismo", /disponible/i]] as const) {
    const q = consultaDePreferencia(t, datos); assert.ok(q, t);
    const r = await responderDisponibilidad(q, datos, deps);
    assert.equal(r.tipo, "respuesta", t); if (r.tipo === "respuesta") { assert.match(r.texto, esperado, t); assert.ok(r.oferta, t); if (t === "Javier" || t === "primero disponible") console.log(`--- ${t}\n${r.texto}`); }
  }
  for (const t of ["hola", "gracias", "si"]) assert.equal(consultaDePreferencia(t, datos), null, t);
  console.log("pedir hora: OK");
}
main();
