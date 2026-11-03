// Reserva por chat: memoria, reserva e indicadores simulados; sin red, sin base, sin llaves, sin depender del reloj.
// Ejecutar: npx tsx scripts/test-agente-reserva-chat.ts
import assert from "node:assert/strict";
import { manejarReservaChat, type DependenciasReserva, type EstadoChat, type CampoIndicador, type ResultadoCreacion } from "../src/lib/agente/reserva-chat";
import type { DatosFaq } from "../src/lib/agente/faq-fija";

let casos = 0;
const caso = async (nombre: string, fn: () => Promise<void> | void) => { casos++; try { await fn(); } catch (e) { throw new Error(`${nombre}: ${e instanceof Error ? e.message : "fallo"}`); } };
const AHORA = Date.UTC(2026, 10, 3, 18, 0); // martes 3-nov-2026, 15:00 Chile
const TEL = "56984939625";
const datos = (servicios?: DatosFaq["servicios"]): DatosFaq => ({
  negocio: { nombre: "N", direccion: null, telefono: null, linkReserva: "https://s.invalid/b/n" }, horario: [], profesionales: [],
  servicios: servicios ?? [{ id: "s1", nombre: "Corte de cabello", precio: 12000, duracionMin: 45 }, { id: "s2", nombre: "Corte + barba", precio: 18000, duracionMin: 60 }, { id: "s3", nombre: "Perfilado de barba", precio: 8000, duracionMin: 30 }],
});
function armar(estado: EstadoChat | null, opts: { futuras?: number; resultado?: ResultadoCreacion } = {}) {
  const e = { estado, creadas: [] as any[], contados: [] as CampoIndicador[], borrados: 0 };
  const deps: DependenciasReserva = {
    ahora: () => AHORA,
    leerEstado: async () => e.estado, guardarEstado: async (x) => { e.estado = x; }, borrarEstado: async () => { e.estado = null; e.borrados++; },
    reservasFuturas: async () => opts.futuras ?? 0,
    crearReserva: async (a) => { e.creadas.push(a); return opts.resultado ?? { ok: true, citaId: "cita-1" }; },
    contar: async (c) => { e.contados.push(c); },
  };
  return { e, deps };
}
const OFERTA_DIEGO: EstadoChat = { etapa: "oferta", datos: { horaExacta: null, opciones: [{ id: "d", nombre: "Diego Fuentes", duracionMin: 45, fecha: "2026-11-03", horas: ["15:15", "16:00", "16:45", "17:30"] }] } };
const OFERTA_VARIOS: EstadoChat = { etapa: "oferta", datos: { horaExacta: null, opciones: [
  { id: "d", nombre: "Diego Fuentes", duracionMin: 45, fecha: "2026-11-03", horas: ["16:00", "16:45"] },
  { id: "c", nombre: "Camila Rojas", duracionMin: 30, fecha: "2026-11-03", horas: ["16:00", "17:00"] },
  { id: "m", nombre: "Matías Soto", duracionMin: 45, fecha: "2026-11-04", horas: ["10:00", "16:00"] },
] } };
const r = (t: string, est: EstadoChat | null, o = {}, d: DatosFaq | null = datos()) => { const a = armar(est, o); return manejarReservaChat(t, TEL, d, a.deps).then((res) => ({ res, ...a })); };

(async () => {
  await caso("Sin memoria no interviene", async () => { const x = await r("quiero la de las 15:15", null); assert.equal(x.res, null); });
  await caso("Elige una hora ofrecida y se le piden los datos con la lista de servicios", async () => {
    const x = await r("quiero la de las 15:15", OFERTA_DIEGO);
    assert.ok(x.res!.texto.startsWith("Perfecto. Te dejo la hora con *Diego Fuentes* hoy a las *15:15*."));
    assert.ok(x.res!.texto.includes("1. Corte de cabello ($12.000)") && x.res!.texto.includes("2. Corte + barba ($18.000)"));
    assert.deepEqual(x.e.estado, { etapa: "datos", datos: { id: "d", nombre: "Diego Fuentes", duracionMin: 45, fecha: "2026-11-03", hora: "15:15", intentos: 0 } });
    assert.deepEqual(x.e.contados, ["reservas_iniciadas"]);
  });
  await caso("Formas de elegir la hora", async () => {
    for (const [msg, hora] of [["la de las 4", "16:00"], ["a las 4 pm", "16:00"], ["quiero las 16:00", "16:00"], ["4:45", "16:45"], ["la de las 17:30 por favor", "17:30"], ["5:30 pm", "17:30"], ["3:15", "15:15"], ["4", "16:00"]] as const) {
      const x = await r(msg, OFERTA_DIEGO);
      assert.equal((x.e.estado as any)?.datos?.hora, hora, msg);
    }
  });
  await caso("'Sí' confirma cuando se ofreció una sola hora exacta", async () => {
    const est: EstadoChat = { etapa: "oferta", datos: { horaExacta: "17:00", opciones: [{ id: "d", nombre: "Diego Fuentes", duracionMin: 45, fecha: "2026-11-03", horas: ["16:00", "17:00"] }] } };
    for (const msg of ["sí", "dale", "ok", "quiero agendar", "esa"]) assert.equal((await r(msg, est)).e.estado && ((await r(msg, est)).e.estado as any).datos.hora, "17:00", msg);
    assert.equal((await r("sí", OFERTA_DIEGO)).res, null); // sin hora exacta, un "sí" no alcanza
  });
  await caso("Hora que no se ofreció: muestra las opciones y mantiene la oferta", async () => {
    const x = await r("la de las 9", OFERTA_DIEGO);
    assert.ok(x.res!.texto.startsWith("Esa hora no está entre las que te ofrecí.") && x.res!.texto.includes("• *Diego Fuentes* hoy: 15:15 · 16:00 · 16:45"));
    assert.equal(x.e.estado?.etapa, "oferta");
  });
  await caso("Hora que tienen varios: pregunta con quién y luego basta el nombre", async () => {
    const x = await r("la de las 4", OFERTA_VARIOS);
    assert.ok(x.res!.texto.startsWith("¿Con quién prefieres a las 16:00?") && x.res!.texto.includes("• *Matías Soto* mañana"));
    assert.equal((x.e.estado as any).datos.horaPendiente, "16:00");
    const y = await manejarReservaChat("con Camila", TEL, datos(), x.deps);
    assert.ok(y!.texto.startsWith("Perfecto. Te dejo la hora con *Camila Rojas* hoy a las *16:00*."));
    assert.equal((x.e.estado as any).datos.id, "c");
  });
  await caso("Con el nombre en la misma frase elige directo", async () => {
    const x = await r("la de las 4 con Matías", OFERTA_VARIOS);
    assert.ok(x.res!.texto.startsWith("Perfecto. Te dejo la hora con *Matías Soto* mañana a las *16:00*."));
  });
  await caso("Una nueva consulta no se confunde con elegir (y la oferta sigue)", async () => {
    for (const msg of ["Diego Fuentes tiene hora para hoy a las 2?", "tienen hora mañana", "hay hora el viernes a las 4"]) { const x = await r(msg, OFERTA_DIEGO); assert.equal(x.res, null, msg); assert.equal(x.e.estado?.etapa, "oferta"); }
  });
  await caso("Decir que no cancela y borra la memoria", async () => {
    for (const msg of ["no", "no gracias", "cancelar", "mejor no", "ya no"]) { const x = await r(msg, OFERTA_DIEGO); assert.ok(x.res!.texto.startsWith("Sin problema, no agendé nada."), msg); assert.equal(x.e.estado, null); }
    const y = await r("no gracias", { etapa: "datos", datos: { id: "d", nombre: "Diego Fuentes", duracionMin: 45, fecha: "2026-11-03", hora: "15:15", intentos: 0 } }); assert.equal(y.e.estado, null);
  });
  await caso("Ya tiene 2 horas futuras: no agenda otra y deriva a una persona", async () => {
    const x = await r("la de las 4", OFERTA_DIEGO, { futuras: 2 });
    assert.equal(x.res!.derivar, true); assert.equal(x.e.estado, null); assert.equal(x.e.creadas.length, 0);
  });

  const DATOS_ETAPA: EstadoChat = { etapa: "datos", datos: { id: "d", nombre: "Diego Fuentes", duracionMin: 45, fecha: "2026-11-03", hora: "15:15", intentos: 0 } };
  await caso("Datos completos: crea la reserva con el celular de WhatsApp y confirma", async () => {
    const x = await r("Juan Pérez, juan@correo.cl, 1", DATOS_ETAPA);
    assert.deepEqual(x.e.creadas, [{ profesionalId: "d", fecha: "2026-11-03", hora: "15:15", servicioId: "s1", nombre: "Juan Pérez", correo: "juan@correo.cl", telefono: TEL }]);
    assert.equal(x.res!.texto, "¡Listo, Juan! Tu hora quedó agendada:\n\n• *Diego Fuentes*\n• hoy a las *15:15*\n• Corte de cabello\n\nTe enviamos el detalle a tu correo. Si necesitas cambiarla, escríbenos por aquí.");
    assert.equal(x.e.estado, null); assert.deepEqual(x.e.contados, ["reservas_cerradas"]);
  });
  await caso("Distintas formas de enviar los datos", async () => {
    for (const [msg, nombre, correo, servicio] of [["maria jose lópez maria@mail.com 2", "Maria Jose López", "maria@mail.com", "s2"], ["Pedro Soto pedro@x.cl Perfilado de barba", "Pedro Soto", "pedro@x.cl", "s3"], ["JUAN PÉREZ\njuan@correo.cl\n1", "Juan Pérez", "juan@correo.cl", "s1"], ["Ana-María O'Higgins; ana@correo.cl; 3", "Ana-maría O'higgins", "ana@correo.cl", "s3"]] as const) {
      const x = await r(msg, DATOS_ETAPA);
      assert.equal(x.e.creadas.length, 1, msg); const c = x.e.creadas[0];
      assert.deepEqual([c.nombre, c.correo, c.servicioId], [nombre, correo, servicio], msg);
    }
  });
  await caso("Un solo servicio: no se pregunta cuál", async () => {
    const d = datos([{ id: "s1", nombre: "Corte", precio: 10000, duracionMin: 30 }]);
    const x = await r("Juan Pérez juan@correo.cl", DATOS_ETAPA, {}, d);
    assert.equal(x.e.creadas[0].servicioId, "s1");
    const y = await r("la de las 4", OFERTA_DIEGO, {}, d);
    assert.ok(!y.res!.texto.includes("el servicio:") && y.res!.texto.includes("por ejemplo") && !y.res!.texto.includes(", 1"));
  });
  await caso("Falta algo: pide solo lo que falta, sin guardar datos a medias, y cuenta intentos", async () => {
    const x = await r("juan@correo.cl", DATOS_ETAPA);
    assert.ok(x.res!.texto.startsWith("Me falta tu nombre completo y el servicio (el número de la lista).") && x.res!.texto.includes("Juan Pérez, juan@correo.cl, 1"));
    assert.equal((x.e.estado as any).datos.intentos, 1); assert.equal(x.e.creadas.length, 0);
    assert.ok(!JSON.stringify(x.e.estado).includes("juan@"));
    const y = await r("Juan Pérez, 1", DATOS_ETAPA); assert.ok(y.res!.texto.startsWith("Me falta tu correo."));
    const z = await r("juan@correo.cl, 1", DATOS_ETAPA); assert.ok(z.res!.texto.startsWith("Me falta tu nombre completo."));
    const w = await r("Juan juan@correo.cl 1", DATOS_ETAPA); assert.ok(w.res!.texto.startsWith("Me falta tu nombre completo."), "nombre de una palabra");
  });
  await caso("Tras 3 intentos fallidos deriva a una persona", async () => {
    const a = armar(DATOS_ETAPA);
    const r1 = await manejarReservaChat("hola", TEL, datos(), a.deps); assert.equal(r1!.derivar, undefined);
    const r2 = await manejarReservaChat("hola otra vez", TEL, datos(), a.deps); assert.equal(r2!.derivar, undefined);
    const r3 = await manejarReservaChat("no sé", TEL, datos(), a.deps); assert.ok(r3 !== null);
    assert.equal(a.e.estado, null);
  });
  await caso("Datos peligrosos no se aceptan (HTML, enlaces)", async () => {
    for (const msg of ["Juan <b>Pérez</b> juan@correo.cl 1", "Juan Pérez juan@correo.cl 1 😀"]) { const x = await r(msg, DATOS_ETAPA); assert.equal(x.e.creadas.length, 0, msg); assert.ok(x.res!.texto.length > 0); }
    const y = await r("Visita http://malo.invalid juan@correo.cl 1", DATOS_ETAPA); assert.equal(y.e.creadas.length, 0);
  });
  await caso("La respuesta solo repite el primer nombre del cliente y nunca el correo", async () => {
    const x = await r("Juan Pérez, juan@correo.cl, 1", DATOS_ETAPA);
    assert.ok(!x.res!.texto.includes("juan@") && !x.res!.texto.includes("Pérez"));
  });
  await caso("Hora ocupada: lo avisa y limpia la memoria", async () => {
    const x = await r("Juan Pérez, juan@correo.cl, 1", DATOS_ETAPA, { resultado: { ok: false, motivo: "ocupada" } });
    assert.ok(x.res!.texto.startsWith("Esa hora se acaba de ocupar.")); assert.equal(x.e.estado, null); assert.deepEqual(x.e.contados, []);
  });
  await caso("Error al reservar: deriva a una persona sin detalles", async () => {
    for (const motivo of ["otro", "suspendido"] as const) { const x = await r("Juan Pérez, juan@correo.cl, 1", DATOS_ETAPA, { resultado: { ok: false, motivo } }); assert.equal(x.res!.derivar, true); assert.equal(x.e.estado, null); }
  });
  await caso("Sin servicios con id no se puede reservar: deriva", async () => {
    const x = await r("la de las 4", OFERTA_DIEGO, {}, datos([{ nombre: "Corte", precio: 1, duracionMin: 30 }])); assert.equal(x.res!.derivar, true);
  });
  console.log(`OK ${casos} casos de reserva por chat; memoria y reserva simuladas; sin red, base ni llaves.`);
})();
