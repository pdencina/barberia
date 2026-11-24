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

const M = async (t: string, ops: OperacionesAdmin, ahora = AHORA) => (await manejarAdmin(t, ops, ahora)) ?? "";
(async () => {
  await caso("Reporte: solo cuando lo pide, con el período correcto", async () => {
    const a = armar();
    const r1 = await M("reporte", a.ops);
    assert.ok(r1.startsWith("📊 Reporte de los últimos 7 días") && r1.includes("Reservas cerradas por el chat: 3") && r1.includes("Derivadas a una persona: 2"));
    assert.deepEqual(a.e.ultimoReporte, ["2026-11-18", "2026-11-24"]);
    await M("Reporte hoy", a.ops); assert.deepEqual(a.e.ultimoReporte, ["2026-11-24", "2026-11-24"]);
    await M("reporte del mes", a.ops); assert.deepEqual(a.e.ultimoReporte, ["2026-11-01", "2026-11-24"]);
  });
  await caso("El administrador conversa como cliente: lo que no es un comando claro devuelve null", async () => {
    const a = armar();
    for (const msg of ["hola", "tienen hora hoy", "sí", "no", "guardar", "descartar", "El viernes 27 cerramos a las 13:00", "cuanto cuesta un corte", "resumen", "menu", "ok", "borrar", "avisos de promoción"]) {
      assert.equal(await manejarAdmin(msg, a.ops, AHORA), null, msg);
    }
    assert.equal(a.e.avisos.length, 0, "ninguna de esas frases guardó ni dejó nada pendiente");
  });
  await caso("'aviso: ...' se muestra y NO se guarda hasta escribir 'guardar'", async () => {
    const a = armar();
    const r = await M("Aviso: el próximo viernes 27 vamos a cerrar a las 13:00 hrs", a.ops);
    assert.ok(r.includes("«el próximo viernes 27 vamos a cerrar a las 13:00 hrs»") && r.includes("Vigente hasta el viernes 27 de noviembre") && r.includes("*guardar*"), r);
    assert.equal((await a.ops.activos("2026-11-24")).length, 0, "todavía no hay avisos vigentes");
    assert.equal(await manejarAdmin("sí", a.ops, AHORA), null, "un 'sí' normal NO confirma el aviso");
    assert.equal((await a.ops.activos("2026-11-24")).length, 0);
    const ok = await M("guardar", a.ops);
    assert.ok(ok.startsWith("Guardado ✅") && ok.includes("no se bloquea"));
    assert.ok((await M("avisos", a.ops)).includes("1. el próximo viernes 27 vamos a cerrar a las 13:00 hrs (hasta el viernes 27 de noviembre)"));
  });
  await caso("Sin fecha en la frase: dura 14 días; 'descartar' lo cancela", async () => {
    const a = armar();
    assert.ok((await M("instrucción: estamos con promoción en cortes esta semana", a.ops)).includes("Vigente hasta el martes 8 de diciembre"));
    assert.equal(await M("descartar", a.ops), "Listo, no guardé nada.");
    assert.equal(await a.ops.pendiente(AHORA), null);
    assert.equal(await manejarAdmin("guardar", a.ops, AHORA), null, "sin pendiente, 'guardar' es una palabra más");
  });
  await caso("Una confirmación vieja (más de 30 min) no guarda nada", async () => {
    const a = armar(); await M("aviso: cerramos el viernes 27 a las 13:00", a.ops);
    assert.equal(await manejarAdmin("guardar", a.ops, AHORA + 31 * 60000), null);
    assert.equal((await a.ops.activos("2026-11-24")).length, 0);
  });
  await caso("Borrar quita el aviso indicado; uno que no existe se avisa", async () => {
    const a = armar();
    for (const x of ["aviso: cerramos el viernes 27 a las 13:00", "aviso: el sábado 28 abrimos desde las 11:00"]) { await M(x, a.ops); await M("guardar", a.ops); }
    assert.equal((await a.ops.activos("2026-11-24")).length, 2);
    assert.equal(await M("borrar 1", a.ops), "Listo, quité el aviso 1.");
    assert.deepEqual((await a.ops.activos("2026-11-24")).map((x) => x.texto), ["el sábado 28 abrimos desde las 11:00"]);
    assert.ok((await M("borrar 5", a.ops)).startsWith("No encuentro el aviso 5"));
  });
  await caso("Ayuda, aviso incompleto o largo, y tope de avisos", async () => {
    const a = armar();
    assert.ok((await M("ayuda", a.ops)).includes("Modo administrador") && (await M("Ayuda!", a.ops)).includes("Modo administrador"));
    assert.ok((await M("aviso: hola", a.ops)).startsWith("Escribe el aviso completo"));
    assert.ok((await M("aviso: " + "x".repeat(301), a.ops)).startsWith("Es muy largo"));
    assert.equal(await a.ops.pendiente(AHORA), null, "lo corto o largo no deja nada pendiente");
    for (let i = 0; i < 10; i++) { await M(`aviso: número ${i} para el viernes 27`, a.ops); await M("guardar", a.ops); }
    await M("aviso: un aviso más para el sábado 28", a.ops);
    assert.ok((await M("guardar", a.ops)).startsWith("Ya hay 10 avisos vigentes"));
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
