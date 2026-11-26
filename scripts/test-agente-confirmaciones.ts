// Confirmación de citas por WhatsApp: ventana de 8 h, botones según el plazo (3 h), solo pendientes y solo negocios con el interruptor. Sin red, base ni llaves.
// Ejecutar: npx tsx scripts/test-agente-confirmaciones.ts
import assert from "node:assert/strict";
import { crearManejadorRecordatorios, crearRepositorioRecordatorios, ventanaConfirmaciones, conBotonesSegunPlazo, anticipacionCita, type CitaRecordatorio, type DependenciasRecordatorios } from "../src/lib/agente/recordatorios-whatsapp";
import { variablesPlantillaConfirmacion, BOTONES_CONFIRMACION, PLANTILLA_CONFIRMACION_BOTONES, PLANTILLA_CITA_AVISO } from "../src/lib/agente/plantilla-recordatorio";
import { enviarPlantilla, normalizarTelefonoWhatsApp } from "../src/lib/agente/whatsapp-meta";
import { clasificarRespuestaCliente } from "../src/lib/agente/respuesta-cliente";
import { cancelarCitaPropia, confirmarCitaPropia, type CitaAccion } from "../src/lib/agente/acciones-cita";

let casos = 0;
const caso = async (n: string, f: () => Promise<void> | void) => { casos++; try { await f(); } catch (e) { throw new Error(`${n}: ${e instanceof Error ? e.message : "fallo"}`); } };
// 25-nov-2026 19:00 UTC = 16:00 en Santiago (horario de verano, UTC-3). Las citas se guardan en hora de pared de Santiago escrita como UTC.
const AHORA = Date.UTC(2026, 10, 25, 19, 0);
const cita = (id: string, hora: string, extra: Partial<CitaRecordatorio> = {}): CitaRecordatorio => ({ id, tenant_id: "T", status: "scheduled", start_time: `2026-11-25T${hora}:00.000Z`, date: "2026-11-25", reminder_sent: false,
  client: { id: "c1", tenant_id: "T", name: "AMARO pérez", phone: "+56911112222", email: null }, barber: { name: "Nicolas" }, services: [{ service: { name: "Solo corte" } }], ...extra });

function armar(filas: CitaRecordatorio[], conInterruptor = true) {
  const e = { enviados: [] as Array<{ id: string; conBotones: boolean | undefined }>, marcadas: [] as string[], reclamos: new Set<string>() };
  const deps: DependenciasRecordatorios = {
    sal: "sal", ahora: () => AHORA,
    repo: {
      negocios: async () => [{ tenantId: "T", phoneNumberId: "1", enabled: true }],
      negociosConfirmacion: async () => conInterruptor ? [{ tenantId: "T", phoneNumberId: "1", enabled: true }] : [],
      negocio: async () => ({ tenantId: "T", phoneNumberId: "1", enabled: true }),
      citas: async () => filas, actual: async (c) => filas.find((x) => x.id === c.id) ?? null,
      baja: async () => false, existe: async (c, ch) => e.reclamos.has(`${c.id}:${ch}`),
      reclamar: async (c, ch) => { const k = `${c.id}:${ch}`; if (e.reclamos.has(k)) return null; e.reclamos.add(k); return `r-${k}`; },
      finalizar: async () => {}, marcarRecordatorio: async (c) => { e.marcadas.push(c.id); const f = filas.find((x) => x.id === c.id); if (f) f.reminder_sent = true; return true; },
    },
    tieneCuota: async () => true, consumirCuota: async () => true,
    enviarWhatsApp: async (_n, c, _p, o) => { e.enviados.push({ id: c.id, conBotones: o?.conBotones }); return { estado: "aceptado", id: `wamid.${c.id}` }; },
    enviarCorreo: async () => ({ estado: "fallido" }),
  };
  const correr = async (modo: "confirmacion" | "recordatorio" = "confirmacion") => (await crearManejadorRecordatorios({ modo, permitirEnvio: true, autorizar: async () => ({ ok: true }), crearDependencias: () => deps })(new Request("https://t.invalid/x"))).json();
  return { e, correr };
}

(async () => {
  await caso("Ventana: desde ahora hasta 8 horas, en hora de Santiago", () => {
    const v = ventanaConfirmaciones(AHORA);
    assert.equal(v.desde.slice(0, 16), "2026-11-25T16:00"); assert.equal(v.hasta.slice(0, 16), "2026-11-26T00:00");
    assert.equal(Math.round(anticipacionCita("2026-11-25T20:00:00.000Z", AHORA) / 60000), 240);
  });
  await caso("Con 3 h o más lleva botones; con menos, solo aviso", () => {
    assert.equal(conBotonesSegunPlazo("2026-11-25T20:00:00.000Z", AHORA), true);   // 4 h
    assert.equal(conBotonesSegunPlazo("2026-11-25T19:01:00.000Z", AHORA), true);   // 3 h 1 min
    assert.equal(conBotonesSegunPlazo("2026-11-25T19:00:00.000Z", AHORA), true);   // 3 h justas: todavía puede cancelar
    assert.equal(conBotonesSegunPlazo("2026-11-25T18:59:00.000Z", AHORA), false);  // 2 h 59 min
    assert.equal(conBotonesSegunPlazo("2026-11-25T17:00:00.000Z", AHORA), false);  // 1 h
  });
  await caso("Envía a las citas pendientes de las próximas 8 h: con botones (>3 h) y sin botones (<3 h)", async () => {
    const a = armar([cita("lejos", "21:00"), cita("cerca", "17:30"), cita("muylejos", "23:59"), cita("fuera", "02:00")]);
    const r = await a.correr();
    assert.deepEqual(a.e.enviados.sort((x, y) => x.id.localeCompare(y.id)), [{ id: "cerca", conBotones: false }, { id: "lejos", conBotones: true }, { id: "muylejos", conBotones: true }]);
    assert.equal(r.whatsapp, 3);
  });
  await caso("No molesta: citas ya confirmadas, pasadas, ya avisadas o sin teléfono", async () => {
    const a = armar([cita("conf", "20:00", { status: "confirmed" }), cita("pasada", "15:00"), cita("ya", "20:00", { reminder_sent: true }),
      cita("sinTel", "20:00", { client: { id: "c2", tenant_id: "T", name: "X", phone: null, email: null } })]);
    await a.correr(); assert.equal(a.e.enviados.length, 0);
  });
  await caso("Solo negocios con el interruptor encendido; el recordatorio de siempre no cambia", async () => {
    const apagado = armar([cita("a", "20:00")], false); await apagado.correr(); assert.equal(apagado.e.enviados.length, 0);
    const rec = armar([cita("b", "20:00")]); await rec.correr("recordatorio");
    assert.equal(rec.e.enviados.length, 0, "el recordatorio usa su ventana de 20 a 28 h: una cita en 4 h no entra");
  });
  await caso("No se repite: una segunda pasada no vuelve a escribir", async () => {
    const a = armar([cita("x", "20:00")]); await a.correr(); await a.correr();
    assert.equal(a.e.enviados.length, 1);
  });
  await caso("Variables de la plantilla: nombre, negocio, servicio, profesional, fecha larga y hora", () => {
    assert.deepEqual(variablesPlantillaConfirmacion(cita("v", "08:30"), "Estudio Levels"), ["Amaro", "Estudio Levels", "Solo corte", "Nicolas", "miércoles, 25 de noviembre", "08:30 (AM)"]);
    assert.equal(variablesPlantillaConfirmacion(cita("v", "08:30", { client: { id: "c", tenant_id: "T", name: null as any, phone: "1", email: null } }), "N")[0], "cliente");
    assert.deepEqual([...BOTONES_CONFIRMACION], ["confirmo mi cita", "cancelo mi cita", "modificar mi cita"]);
  });
  await caso("La plantilla con botones envía 3 respuestas rápidas con su payload; sin botones, solo el cuerpo", async () => {
    const cuerpos: any[] = [];
    const fetch = async (_u: string, o: RequestInit) => { cuerpos.push(JSON.parse(String(o.body))); return { status: 200, json: async () => ({ messages: [{ id: "wamid.1" }] }) }; };
    const deps = { token: "t", version: "v21.0", phone_number_id: "1", fetch };
    const v = ["Amaro", "Estudio Levels", "Solo corte", "Nicolas", "miércoles, 25 de noviembre", "08:30 (AM)"];
    assert.equal((await enviarPlantilla({ para: "56911112222", plantilla: PLANTILLA_CONFIRMACION_BOTONES, idioma: "es", variables: v, botones: BOTONES_CONFIRMACION }, deps)).estado, "aceptado");
    const comp = cuerpos[0].template.components;
    assert.equal(cuerpos[0].template.name, "confirmacion_cita_botones"); assert.equal(comp.length, 4);
    assert.deepEqual(comp.slice(1).map((c: any) => [c.sub_type, c.index, c.parameters[0].payload]), [["quick_reply", "0", "confirmo mi cita"], ["quick_reply", "1", "cancelo mi cita"], ["quick_reply", "2", "modificar mi cita"]]);
    await enviarPlantilla({ para: "56911112222", plantilla: PLANTILLA_CITA_AVISO, idioma: "es", variables: v }, deps);
    assert.equal(cuerpos[1].template.components.length, 1);
    assert.equal((await enviarPlantilla({ para: "56911112222", plantilla: "x", idioma: "es", variables: v, botones: ["a", "b", "c", "d"] }, deps)).estado, "fallido", "más de 3 botones no se envía");
  });
  await caso("Las respuestas de los botones se entienden: confirmar, cancelar y modificar", () => {
    assert.equal(clasificarRespuestaCliente("confirmo mi cita"), "confirmar"); assert.equal(clasificarRespuestaCliente("cancelo mi cita"), "cancelar");
    assert.equal(clasificarRespuestaCliente("modificar mi cita"), "modificar"); assert.equal(clasificarRespuestaCliente("Quiero cambiar mi cita"), "modificar");
    assert.equal(clasificarRespuestaCliente("no modificar nada"), "desconocido");
  });
  await caso("Cancelar o modificar solo hasta 3 horas antes; confirmar hasta que empiece", async () => {
    const mk = (hora: string, estado = "scheduled") => {
      const c: CitaAccion = { id: "a", tenant_id: "T", client_id: "c1", status: estado, date: "2026-11-25", start_time: `2026-11-25T${hora}:00.000Z`, barber_id: null };
      let cambios = 0;
      return { c, cambios: () => cambios, deps: { ahora: () => AHORA, notificar: async () => {}, repo: { desdeRecordatorio: async () => c, transicionar: async () => { cambios++; return true; } } } };
    };
    const ctx = { tenantId: "T", clienteId: "c1", referenciaRecordatorio: "r" };
    const tarde = mk("18:30"); assert.equal((await cancelarCitaPropia(ctx, tarde.deps)).motivo, "fuera_de_plazo"); assert.equal(tarde.cambios(), 0);
    const justo = mk("18:59"); assert.equal((await cancelarCitaPropia(ctx, justo.deps)).motivo, "fuera_de_plazo", "2 h 59 min ya no");
    const exacto = mk("19:00"); assert.equal((await cancelarCitaPropia(ctx, exacto.deps)).motivo, "ok", "3 h justas todavía sí");
    const ok = mk("19:05"); assert.equal((await cancelarCitaPropia(ctx, ok.deps)).motivo, "ok"); assert.equal(ok.cambios(), 1);
    const conf = mk("17:30"); assert.equal((await confirmarCitaPropia(ctx, conf.deps)).motivo, "ok", "confirmar sí se puede con menos de 3 h");
  });
  await caso("Sin la columna reminder_sent (producción): el repositorio no la pide ni la filtra ni la escribe", async () => {
    const llamadas: any[] = [];
    const fila = { id: "a1", tenant_id: "T", client_id: "c1", status: "scheduled", date: "2026-11-25", start_time: "2026-11-25T20:00:00.000Z", client: { id: "c1", tenant_id: "T", name: "X", email: null, phone: "+56911112222" }, barber: { name: "N" }, services: [] };
    const db: any = { from(tabla: string) {
      const l: any = { tabla, filtros: [] }; llamadas.push(l);
      const q: any = {
        select(c: string) { l.select = c; return q; }, eq(c: string, v: unknown) { l.filtros.push(c); return q; }, in() { return q; }, gte() { return q; }, lte() { return q; },
        order() { return q; }, update() { l.update = true; return q; },
        range: async () => ({ data: [fila], error: null }), maybeSingle: async () => ({ data: fila, error: null }),
      }; return q;
    } };
    const repo = crearRepositorioRecordatorios(db, { sinMarca: true });
    const filas = await repo.citas("T", { desde: "2026-11-25T16:00:00.000Z", hasta: "2026-11-26T00:00:00.000Z" });
    assert.equal(filas[0].reminder_sent, false);
    const act = await repo.actual(filas[0]); assert.equal(act!.reminder_sent, false);
    assert.equal(await repo.marcarRecordatorio(filas[0], AHORA), true);
    for (const l of llamadas) { assert.ok(!String(l.select ?? "").includes("reminder_sent"), "no pide la columna"); assert.ok(!l.filtros.includes("reminder_sent"), "no la filtra"); assert.ok(!l.update, "no escribe"); }
  });
  await caso("Teléfonos pegados desde el celular (con marcas invisibles) se aceptan; letras u otros símbolos siguen rechazados", () => {
    assert.equal(normalizarTelefonoWhatsApp("\u202a+56 9 1234 0468\u202c"), "56912340468");
    assert.equal(normalizarTelefonoWhatsApp("\u200e+56 9 1234 0468"), "56912340468");
    assert.equal(normalizarTelefonoWhatsApp("+56 9 1234 0468"), "56912340468");
    assert.equal(normalizarTelefonoWhatsApp("9 1234 0468"), "56912340468");
    assert.equal(normalizarTelefonoWhatsApp("+56 9 1234 04x8"), null);
    assert.equal(normalizarTelefonoWhatsApp("\u202a\u202c"), null);
    assert.equal(normalizarTelefonoWhatsApp(null), null);
  });
  console.log(`OK ${casos} casos de confirmación por WhatsApp; sin red, base ni llaves.`);
})().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
