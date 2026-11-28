import assert from "node:assert/strict";
import { tipoDeAviso, responderAviso } from "../src/lib/agente/aviso-cliente";
import { esCierreConversacion } from "../src/lib/agente/menu";
import { interpretarFecha, separarHora } from "../src/lib/agente/disponibilidad";

async function main() {
  for (const [t, e] of [["ya re agende para más tarde", "agendo"], ["Ya reagendé", "agendo"], ["listo ya agendé para las 8", "agendo"], ["ya cancelé mi hora", "cancelo"], ["voy en camino", "camino"], ["cancelé mi hora", "cancelo"], ["reagendé para las 8", "agendo"], ["estoy afuera", "camino"]] as const) assert.equal(tipoDeAviso(t), e, t);
  for (const t of ["Pero yo ya agende y quisiera saber si se agendó bien la hora", "ya agendé?", "ya reservé pero no me llegó el correo", "quiero reagendar", "cancele mi hora por favor", "cancele mi cita", "reagende mi hora", "puedo agendar más tarde", "ya cancelé el abono", "tienen hora más tarde", "hola"]) assert.equal(tipoDeAviso(t), null, t);
  const buscar: any = async () => ({ nombre: "N", codigo: null, citas: [{ profesional: "Javier García", fecha: "2026-11-27", hora: "17:45", servicio: "" }] });
  const r = await responderAviso("ya re agende para más tarde", "2026-11-27", "569", buscar);
  assert.match(r!, /gracias por avisar[\s\S]*Javier García\*, hoy a las \*17:45/);
  assert.doesNotMatch(r!, /no tiene horas/);
  assert.match((await responderAviso("ya reagendé", "2026-11-27", "569", async () => null))!, /código de reserva/);
  assert.ok(esCierreConversacion("ok gracias"));
  for (const t of ["Estoy afuera y no sale nadie", "No sale nadie", "no me abren", "estoy afuera, nadie me abre?"]) assert.equal(tipoDeAviso(t), "puerta", t);
  assert.match((await responderAviso("No sale nadie", "2026-11-28", "569"))!, /avisando al equipo/);
  // El 28 de noviembre de 2026 es sábado.
  for (const [t, f] of [["tiene el sabado", "2026-11-28"], ["y el proximo sabado", "2026-12-05"], ["el sabado que viene", "2026-12-05"], ["el proximo sabado a que hora tiene disponible sabado 5 de dieciembre", "2026-12-05"], ["el 2 de diciembre", "2026-12-02"], ["el proximo lunes", "2026-11-30"], ["sabado 5 de diciembre en la mañana", "2026-12-05"]] as const) {
    const r = interpretarFecha(t, "2026-11-28"); assert.ok(r !== "invalida" && r.fecha === f, `${t}: ${JSON.stringify(r)}`);
  }
  for (const t of ["No podré asistir", "Deseo cancelar amigo, por favor", "hoy no voy a poder ir"]) assert.equal(tipoDeAviso(t), "noasisto", t);
  assert.equal(tipoDeAviso("Tengo un problema con una hora a las 1300 con Felipe Meza"), "problema");
  for (const t of ["quiero cancelar el abono", "puedo ir mas tarde?", "no puedo reservar"]) assert.equal(tipoDeAviso(t), null, t);
  assert.equal(separarHora("para las 1545 porfa"), "para las 15:45 porfa");
  assert.equal(separarHora("a las 15.45"), "a las 15:45");
  assert.equal(separarHora("el 2026"), "el 2026");
  console.log("avisos del cliente: OK");
}
main();
