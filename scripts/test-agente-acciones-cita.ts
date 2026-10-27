import assert from "node:assert/strict";
import { cancelarCitaPropia, confirmarCitaPropia, crearRepositorioAccionesCita, MigracionAccionesCitaPendiente, type CitaAccion, type ContextoAccionCita } from "../src/lib/agente/acciones-cita";

const contexto: ContextoAccionCita = { tenantId: "negocio-simulado", clienteId: "cliente-simulado", referenciaRecordatorio: "envio-simulado" };
const inicial: CitaAccion = { id: "cita-simulada", tenant_id: contexto.tenantId, client_id: contexto.clienteId, status: "scheduled", date: "2026-10-27", start_time: "2026-10-27T12:00:00Z", barber_id: "equipo-simulado", client: { name: "Cliente de prueba" } };
let pruebas = 0;
async function test(nombre: string, fn: () => Promise<void>) { await fn(); pruebas++; console.log(`OK ${nombre}`); }
function escenario(patch: Partial<CitaAccion> = {}, ahora = "2026-10-27T12:00:00Z") {
  let fila = { ...inicial, ...patch };
  const avisos: any[] = [];
  let cambios = 0;
  let fallaAviso = false;
  const deps = {
    ahora: () => Date.parse(ahora),
    repo: {
      async desdeRecordatorio(c: ContextoAccionCita) { return c.referenciaRecordatorio === contexto.referenciaRecordatorio ? { ...fila } : null; },
      async transicionar(c: CitaAccion, estado: "confirmed" | "cancelled") {
        if (fila.status !== c.status || fila.start_time !== c.start_time) return false;
        fila = { ...fila, status: estado }; cambios++; return true;
      },
    },
    async notificar(input: any) { avisos.push(input); if (fallaAviso) throw new Error("Fallo simulado"); },
  };
  return { deps, avisos, get fila() { return fila; }, get cambios() { return cambios; }, romperAviso() { fallaAviso = true; }, mover() { fila = { ...fila, start_time: "2026-10-27T09:01:00Z" }; } };
}

async function main() {
  await test("confirmar y repetir sin segunda transición", async () => {
    const e = escenario();
    assert.deepEqual(await confirmarCitaPropia(contexto, e.deps), { motivo: "ok" });
    assert.deepEqual(await confirmarCitaPropia(contexto, e.deps), { motivo: "ya_estaba" });
    assert.equal(e.cambios, 1); assert.equal(e.avisos.length, 0);
  });
  for (const patch of [{ client_id: "otro-cliente" }, { tenant_id: "otro-negocio" }]) await test("rechaza cita ajena o negocio cruzado", async () => {
    const e = escenario(patch); assert.deepEqual(await cancelarCitaPropia(contexto, e.deps), { motivo: "no_encontrada" }); assert.equal(e.cambios, 0);
  });
  await test("referencia inexistente nunca acepta id de cita", async () => {
    const e = escenario(); assert.equal((await confirmarCitaPropia({ ...contexto, referenciaRecordatorio: inicial.id }, e.deps)).motivo, "no_encontrada");
  });
  for (const status of ["completed", "no_show", "cancelled"]) await test(`confirmar rechaza ${status}`, async () => {
    const e = escenario({ status }); assert.equal((await confirmarCitaPropia(contexto, e.deps)).motivo, "estado_no_permitido"); assert.equal(e.cambios, 0);
  });
  for (const status of ["completed", "no_show"]) await test(`cancelar rechaza ${status}`, async () => {
    const e = escenario({ status }); assert.equal((await cancelarCitaPropia(contexto, e.deps)).motivo, "estado_no_permitido");
  });
  await test("cancelada es idempotente", async () => {
    const e = escenario({ status: "cancelled" }); assert.equal((await cancelarCitaPropia(contexto, e.deps)).motivo, "ya_estaba"); assert.equal(e.cambios, 0); assert.equal(e.avisos.length, 0);
  });
  for (const accion of [confirmarCitaPropia, cancelarCitaPropia]) await test("cita pasada rechazada", async () => {
    const e = escenario({ start_time: "2026-10-27T08:00:00Z" }); assert.equal((await accion(contexto, e.deps)).motivo, "fuera_de_plazo");
  });
  await test("menos de dos horas incluso por un milisegundo", async () => {
    const e = escenario({ start_time: "2026-10-27T11:00:00Z" }, "2026-10-27T12:00:00.001Z");
    assert.equal((await cancelarCitaPropia(contexto, e.deps)).motivo, "fuera_de_plazo"); assert.equal(e.cambios, 0);
  });
  await test("exactamente dos horas y aviso idéntico al público", async () => {
    const e = escenario({ start_time: "2026-10-27T11:00:00Z", status: "confirmed" });
    assert.deepEqual(await cancelarCitaPropia(contexto, e.deps), { motivo: "ok" });
    assert.equal(e.avisos.length, 1); assert.equal(e.avisos[0].title, "😕 Se canceló una cita");
    assert.equal(e.avisos[0].body, "Cliente de prueba canceló su hora del mar, 27 oct a las 11:00. El espacio quedó libre.");
    assert.deepEqual(e.avisos[0].roles, ["admin", "receptionist"]);
  });
  await test("dos cancelaciones simultáneas producen una transición y aviso", async () => {
    const e = escenario(); const r = await Promise.all([cancelarCitaPropia(contexto, e.deps), cancelarCitaPropia(contexto, e.deps)]);
    assert.deepEqual(r.map(x => x.motivo).sort(), ["ok", "ya_estaba"]); assert.equal(e.cambios, 1); assert.equal(e.avisos.length, 1);
  });
  await test("dos confirmaciones simultáneas producen una transición", async () => {
    const e = escenario(); const r = await Promise.all([confirmarCitaPropia(contexto, e.deps), confirmarCitaPropia(contexto, e.deps)]);
    assert.deepEqual(r.map(x => x.motivo).sort(), ["ok", "ya_estaba"]); assert.equal(e.cambios, 1);
  });
  await test("fallo de notify no invalida cancelación ni permite repetir aviso", async () => {
    const e = escenario(); e.romperAviso(); assert.equal((await cancelarCitaPropia(contexto, e.deps)).motivo, "ok");
    assert.equal((await cancelarCitaPropia(contexto, e.deps)).motivo, "ya_estaba"); assert.equal(e.avisos.length, 1);
  });
  for (const [ahora, start_time, date] of [
    ["2026-07-15T13:00:00Z", "2026-07-15T11:00:00Z", "2026-07-15"], // invierno: 09:00 Chile
    ["2026-09-06T04:00:00Z", "2026-09-06T03:00:00Z", "2026-09-06"], // salto verano: 01:00 Chile
    ["2026-10-28T02:30:00Z", "2026-10-28T01:30:00Z", "2026-10-28"], // 23:30 del día anterior
  ]) await test(`corte de pared Chile ${date}`, async () => {
    const e = escenario({ start_time, date }, ahora); assert.equal((await cancelarCitaPropia(contexto, e.deps)).motivo, "ok");
  });
  await test("cambio de horario concurrente no cancela ni avisa", async () => {
    const e = escenario(); const original = e.deps.repo.transicionar;
    e.deps.repo.transicionar = async (c, destino) => { e.mover(); return original(c, destino); };
    assert.equal((await cancelarCitaPropia(contexto, e.deps)).motivo, "estado_no_permitido"); assert.equal(e.avisos.length, 0);
  });
  // Prueba el adapter real con PostgREST simulado: filtros, registro emitido y CAS.
  await test("adapter filtra registro y cita y hace UPDATE condicional", async () => {
    const llamadas: any[] = [];
    const salidas = [{ data: { appointment_id: inicial.id } }, { data: inicial }, { data: { id: inicial.id } }];
    const db = { from(tabla: string) {
      const llamada: any = { tabla, filtros: [] }; llamadas.push(llamada);
      const query: any = {
        select(campos: string) { llamada.select = campos; return query; },
        eq(campo: string, valor: unknown) { llamada.filtros.push([campo, valor]); return query; },
        update(patch: unknown) { llamada.patch = patch; return query; },
        async maybeSingle() { return salidas.shift(); },
      }; return query;
    } };
    const repo = crearRepositorioAccionesCita(db); const c = await repo.desdeRecordatorio(contexto); assert.ok(c);
    assert.equal(await repo.transicionar(c, "cancelled"), true);
    for (const filtro of [["id", contexto.referenciaRecordatorio], ["tenant_id", contexto.tenantId], ["channel", "whatsapp"], ["purpose", "recordatorio-cita-v1"], ["status", "aceptado_proveedor"]]) assert.ok(llamadas[0].filtros.some((x: any) => JSON.stringify(x) === JSON.stringify(filtro)));
    assert.ok(llamadas[1].filtros.some((x: any) => x[0] === "client_id" && x[1] === contexto.clienteId));
    for (const campo of ["id", "tenant_id", "client_id", "status", "start_time", "date"]) assert.ok(llamadas[2].filtros.some((x: any) => x[0] === campo && x[1] === (inicial as any)[campo]));
    assert.deepEqual(llamadas[2].patch, { status: "cancelled" });
  });
  await test("migración ausente avisa 005 sin error crudo", async () => {
    const q: any = { select() { return q; }, eq() { return q; }, async maybeSingle() { return { error: { code: "42P01", message: "dato privado simulado" } }; } };
    await assert.rejects(() => crearRepositorioAccionesCita({ from: () => q }).desdeRecordatorio(contexto), (e: unknown) => e instanceof MigracionAccionesCitaPendiente && e.message === "Falta aplicar la migración 005");
  });
  console.log(`${pruebas} pruebas pasaron (sin red/base/llaves).`);
}
main().catch(() => { console.error("Falló una prueba de acciones de cita"); process.exitCode = 1; });
