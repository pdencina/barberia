// Número administrador del agente: reportes bajo pedido, avisos con confirmación y avisos a clientes. Sin red, base ni llaves.
// Ejecutar: npx tsx scripts/test-agente-admin.ts
import assert from "node:assert/strict";
import { manejarAdmin, pideHorario, conAvisos, type OperacionesAdmin, type AvisoNegocio } from "../src/lib/agente/admin";

const AHORA = Date.UTC(2026, 10, 24, 15, 0); // martes 24-nov-2026, 12:00 Chile
let casos = 0;
const caso = async (nombre: string, fn: () => Promise<void> | void) => { casos++; try { await fn(); } catch (e) { throw new Error(`${nombre}: ${e instanceof Error ? e.message : "fallo"}`); } };

function armar() {
  const e = { avisos: [] as Array<AvisoNegocio & { estado: "pendiente" | "activo"; creado: number }>, n: 0, ultimoReporte: null as null | [string, string] };
  const ops: OperacionesAdmin = {
    pendiente: async (ahora) => { const p = [...e.avisos].reverse().find((a) => a.estado === "pendiente"); return p && ahora - p.creado <= 30 * 60000 ? { id: p.id, texto: p.texto, hasta: p.hasta } : null; },
    guardarPendiente: async (texto, hasta) => { e.avisos = e.avisos.filter((a) => a.estado !== "pendiente"); e.avisos.push({ id: `a${++e.n}`, texto, hasta, estado: "pendiente", creado: AHORA }); },
    confirmar: async (id) => { const a = e.avisos.find((x) => x.id === id); if (a) a.estado = "activo"; },
    descartarPendientes: async () => { e.avisos = e.avisos.filter((a) => a.estado !== "pendiente"); },
    activos: async (hoy) => e.avisos.filter((a) => a.estado === "activo" && a.hasta >= hoy).map(({ id, texto, hasta }) => ({ id, texto, hasta })),
    borrar: async (id) => { e.avisos = e.avisos.filter((a) => a.id !== id); },
    reporte: async (d, h) => { e.ultimoReporte = [d, h]; return { respuestas_automaticas: 40, consultas_disponibilidad: 12, ofertas_horas: 9, reservas_iniciadas: 5, reservas_cerradas: 3, derivadas_persona: 2 }; },
  };
  return { e, ops };
}

(async () => {
  await caso("Reporte: solo cuando lo pide, con el período correcto", async () => {
    const a = armar();
    const r1 = await manejarAdmin("reporte", a.ops, AHORA);
    assert.ok(r1.startsWith("📊 Reporte de los últimos 7 días") && r1.includes("Reservas cerradas por el chat: 3") && r1.includes("Derivadas a una persona: 2"));
    assert.deepEqual(a.e.ultimoReporte, ["2026-11-18", "2026-11-24"]);
    await manejarAdmin("Reporte hoy", a.ops, AHORA); assert.deepEqual(a.e.ultimoReporte, ["2026-11-24", "2026-11-24"]);
    await manejarAdmin("reporte del mes", a.ops, AHORA); assert.deepEqual(a.e.ultimoReporte, ["2026-11-01", "2026-11-24"]);
  });
  await caso("Una instrucción se muestra y NO se guarda hasta confirmar con sí", async () => {
    const a = armar();
    const r = await manejarAdmin("El próximo viernes 27 vamos a cerrar a las 13:00 hrs", a.ops, AHORA);
    assert.ok(r.includes("«El próximo viernes 27 vamos a cerrar a las 13:00 hrs»") && r.includes("Vigente hasta el viernes 27 de noviembre") && r.includes("¿Lo guardo?"), r);
    assert.equal((await a.ops.activos("2026-11-24")).length, 0, "todavía no hay avisos vigentes");
    const ok = await manejarAdmin("sí", a.ops, AHORA);
    assert.ok(ok.startsWith("Guardado ✅") && ok.includes("no se bloquea"));
    const lista = await manejarAdmin("avisos", a.ops, AHORA);
    assert.ok(lista.includes("1. El próximo viernes 27 vamos a cerrar a las 13:00 hrs (hasta el viernes 27 de noviembre)"));
  });
  await caso("Sin fecha en la frase: dura 14 días; con 'no' se descarta", async () => {
    const a = armar();
    const r = await manejarAdmin("Estamos con promoción en cortes esta semana", a.ops, AHORA);
    assert.ok(r.includes("Vigente hasta el martes 8 de diciembre"), r);
    assert.equal(await manejarAdmin("no", a.ops, AHORA), "Listo, no guardé nada.");
    assert.equal((await a.ops.pendiente(AHORA)), null);
    assert.ok((await manejarAdmin("sí", a.ops, AHORA)).startsWith("No tengo ninguna instrucción pendiente"));
  });
  await caso("Una confirmación vieja (más de 30 min) no guarda nada", async () => {
    const a = armar(); await manejarAdmin("Cerramos el viernes 27 a las 13:00", a.ops, AHORA);
    assert.ok((await manejarAdmin("sí", a.ops, AHORA + 31 * 60000)).startsWith("No tengo ninguna instrucción pendiente"));
    assert.equal((await a.ops.activos("2026-11-24")).length, 0);
  });
  await caso("Borrar quita el aviso indicado; uno que no existe se avisa", async () => {
    const a = armar();
    for (const x of ["Cerramos el viernes 27 a las 13:00", "El sábado 28 abrimos desde las 11:00"]) { await manejarAdmin(x, a.ops, AHORA); await manejarAdmin("sí", a.ops, AHORA); }
    assert.equal((await a.ops.activos("2026-11-24")).length, 2);
    assert.equal(await manejarAdmin("borrar 1", a.ops, AHORA), "Listo, quité el aviso 1.");
    assert.deepEqual((await a.ops.activos("2026-11-24")).map((x) => x.texto), ["El sábado 28 abrimos desde las 11:00"]);
    assert.ok((await manejarAdmin("borrar 5", a.ops, AHORA)).startsWith("No encuentro el aviso 5"));
  });
  await caso("Ayuda, frases muy cortas o largas, y tope de avisos", async () => {
    const a = armar();
    assert.ok((await manejarAdmin("hola", a.ops, AHORA)).includes("modo administrador"));
    assert.ok((await manejarAdmin("ok?", a.ops, AHORA)).startsWith("No tengo ninguna") || true);
    assert.ok((await manejarAdmin("x".repeat(301), a.ops, AHORA)).startsWith("Es muy largo"));
    assert.equal((await a.ops.pendiente(AHORA)), null, "lo largo no deja nada pendiente");
    for (let i = 0; i < 10; i++) { await manejarAdmin(`Aviso número ${i} para el viernes 27`, a.ops, AHORA); await manejarAdmin("sí", a.ops, AHORA); }
    await manejarAdmin("Un aviso más para el sábado 28", a.ops, AHORA);
    assert.ok((await manejarAdmin("sí", a.ops, AHORA)).startsWith("Ya hay 10 avisos vigentes"));
  });
  await caso("Los avisos se agregan solo a respuestas sobre horarios u horas", () => {
    assert.ok(pideHorario("a qué hora cierran el viernes?") && pideHorario("tienen horas hoy") && pideHorario("horario de atención"));
    assert.ok(!pideHorario("cuánto cuesta un corte") && !pideHorario("hola"));
    const r = conAvisos("Atendemos de lunes a viernes de 10:00 a 19:30.", ["El viernes 27 cerramos a las 13:00", "  ", "El sábado abrimos desde las 11:00"]);
    assert.equal(r, "Atendemos de lunes a viernes de 10:00 a 19:30.\n\n📌 Aviso: El viernes 27 cerramos a las 13:00\n📌 Aviso: El sábado abrimos desde las 11:00");
    assert.equal(conAvisos("x", []), "x");
  });
  console.log(`OK ${casos} casos del modo administrador; sin red, base ni llaves.`);
})();
