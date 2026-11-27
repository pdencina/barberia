import assert from "node:assert/strict";
import { tipoDeAviso, responderAviso } from "../src/lib/agente/aviso-cliente";
import { esCierreConversacion } from "../src/lib/agente/menu";

async function main() {
  for (const [t, e] of [["ya re agende para más tarde", "agendo"], ["Ya reagendé", "agendo"], ["listo ya agendé para las 8", "agendo"], ["ya cancelé mi hora", "cancelo"], ["voy en camino", "camino"], ["cancelé mi hora", "cancelo"], ["reagendé para las 8", "agendo"], ["estoy afuera", "camino"]] as const) assert.equal(tipoDeAviso(t), e, t);
  for (const t of ["Pero yo ya agende y quisiera saber si se agendó bien la hora", "ya agendé?", "ya reservé pero no me llegó el correo", "quiero reagendar", "cancele mi hora por favor", "cancele mi cita", "reagende mi hora", "puedo agendar más tarde", "ya cancelé el abono", "tienen hora más tarde", "hola"]) assert.equal(tipoDeAviso(t), null, t);
  const buscar: any = async () => ({ nombre: "N", codigo: null, citas: [{ profesional: "Javier García", fecha: "2026-11-27", hora: "17:45", servicio: "" }] });
  const r = await responderAviso("ya re agende para más tarde", "2026-11-27", "569", buscar);
  assert.match(r!, /gracias por avisar[\s\S]*Javier García\*, hoy a las \*17:45/);
  assert.doesNotMatch(r!, /no tiene horas/);
  assert.match((await responderAviso("ya reagendé", "2026-11-27", "569", async () => null))!, /código de reserva/);
  assert.ok(esCierreConversacion("ok gracias"));
  console.log("avisos del cliente: OK");
}
main();
