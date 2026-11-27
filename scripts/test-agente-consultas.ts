// Consultas difíciles: el dueño responde con una instrucción, el agente responde al cliente y guarda la respuesta. Sin red, base ni llaves.
// Ejecutar: npx tsx scripts/test-agente-consultas.ts
import assert from "node:assert/strict";
import { responderPersonalizadas } from "../src/lib/agente/faq-extra";
import { normalizar } from "../src/lib/agente/faq-fija";
import { manejarConsultaAdmin, botonesDeConsulta, leerRedaccion, avisoDeConsulta, avisoDeImagen, TEXTO_ABONO_OK, type OperacionesConsulta, type Consulta } from "../src/lib/agente/consultas";

const CONTEXTO = "El curso cuesta $390.000. Abono de $100.000. Horario: martes y miércoles de 19:00 a 22:30. Atendemos en Juan de Dios Malebrán 1889.";
let casos = 0;
const caso = async (n: string, f: () => Promise<void>) => { casos++; try { await f(); } catch (e) { throw new Error(`${n}: ${e instanceof Error ? e.message : "fallo"}`); } };

function armar(salidaIA: string | null | ((notas: string) => string | null), ventana = true) {
  const e = { consultas: [{ id: "c1", numero: 3, telefono: "56911112222", pregunta: "¿Puedo pagar el curso en cuotas con tarjeta?", notas: null as string | null, wamid: "wamid.AVISO" }] as Array<Consulta & { wamid: string }>, enviados: [] as string[], saber: [] as Array<{ id: string; titulo: string; claves: string[]; respuesta: string }>, ia: 0 };
  const ops: OperacionesConsulta = {
    buscar: async (r) => ("numero" in r ? e.consultas.find((c) => c.numero === r.numero) : e.consultas.find((c) => c.wamid === r.wamid)) ?? null,
    abiertas: async () => e.consultas,
    guardarNotas: async (id, notas) => { const c = e.consultas.find((x) => x.id === id); if (c) c.notas = notas; },
    redactar: async ({ notas }) => { e.ia++; return typeof salidaIA === "function" ? salidaIA(notas) : salidaIA; },
    contexto: async () => CONTEXTO,
    enviarAlCliente: async (_c, t) => { if (!ventana) return false; e.enviados.push(t); return true; },
    guardarSaber: async (a) => { e.saber.push({ id: `s${e.saber.length + 1}`, ...a }); return true; },
    cerrar: async (id) => { e.consultas = e.consultas.filter((c) => c.id !== id); },
    saberLista: async () => e.saber.map(({ id, titulo }) => ({ id, titulo })),
    saberBorrar: async (id) => { e.saber = e.saber.filter((s) => s.id !== id); },
  };
  return { e, ops };
}
const LISTO = JSON.stringify({ estado: "listo", respuesta: "Sí, puedes pagar el saldo en cuotas. El abono de $100.000 reserva tu cupo.", titulo: "Pago del curso en cuotas", claves: ["pagar en cuotas", "cuotas curso", "¿se puede pagar en cuotas?"] });

(async () => {
  await caso("El aviso al dueño muestra el número y explica cómo responder", async () => {
    const a = avisoDeConsulta({ numero: 3, pregunta: "¿Hay cuotas?" });
    assert.ok(a.includes("Consulta #3") && a.includes("«¿Hay cuotas?»") && a.includes("3: tu instrucción") && a.includes("3: descartar"));
  });
  await caso("'N: instrucción' responde al cliente, guarda el saber y cierra la consulta", async () => {
    const a = armar(LISTO);
    const r = (await manejarConsultaAdmin("3: dile que sí, el saldo en cuotas, el abono de $100.000 reserva el cupo", undefined, a.ops)) ?? "";
    assert.ok(r.startsWith("✅ Respondí la consulta #3") && r.includes("La guardé para la próxima vez"), r);
    assert.deepEqual(a.e.enviados, ["Sí, puedes pagar el saldo en cuotas. El abono de $100.000 reserva tu cupo."]);
    assert.equal(a.e.saber.length, 1);
    assert.equal(a.e.saber[0].titulo, "Pago del curso en cuotas");
    assert.ok(a.e.saber[0].claves.includes("pagar en cuotas") && a.e.saber[0].claves.includes("se puede pagar en cuotas"), "claves limpias, sin signos");
    assert.equal(a.e.consultas.length, 0, "la consulta (teléfono y pregunta) se borra");
  });
  await caso("Citar el aviso (sin número) también responde", async () => {
    const a = armar(LISTO);
    const r = (await manejarConsultaAdmin("Dile que sí, en cuotas el saldo de $100.000", "wamid.AVISO", a.ops)) ?? "";
    assert.ok(r.startsWith("✅ Respondí la consulta #3"), r);
    assert.equal(a.e.enviados.length, 1);
  });
  await caso("Conversación normal del dueño (sin número ni cita, o número que no existe) no se toca", async () => {
    const a = armar(LISTO);
    for (const [t, ctx] of [["hola", undefined], ["tienen hora hoy", undefined], ["9: algo", undefined], ["1", undefined], ["gracias", "wamid.OTRO"]] as const) {
      assert.equal(await manejarConsultaAdmin(t, ctx, a.ops), null, t);
    }
    assert.equal(a.e.enviados.length, 0); assert.equal(a.e.ia, 0); assert.equal(a.e.consultas.length, 1);
  });
  await caso("Si algo no queda claro, el agente le pregunta al dueño y no envía nada; la siguiente instrucción se suma", async () => {
    const a = armar((notas) => notas.includes("cuotas") ? LISTO : JSON.stringify({ estado: "aclarar", pregunta: "¿Se puede pagar en cuotas o solo el abono?" }));
    const r1 = (await manejarConsultaAdmin("3: dile que sí", undefined, a.ops)) ?? "";
    assert.ok(r1.startsWith("❔ Consulta #3: ¿Se puede pagar en cuotas o solo el abono?") && r1.includes("3: ..."), r1);
    assert.equal(a.e.enviados.length, 0); assert.equal(a.e.consultas.length, 1);
    const r2 = (await manejarConsultaAdmin("3: el saldo en cuotas", undefined, a.ops)) ?? "";
    assert.ok(r2.startsWith("✅ Respondí"), r2);
    assert.equal(a.e.consultas.length, 0);
  });
  await caso("La IA no puede inventar datos: un precio que no está en el contexto ni en la instrucción se rechaza", async () => {
    const mala = JSON.stringify({ estado: "listo", respuesta: "Sí, tiene 20% de descuento y cuesta $350.000.", titulo: "Descuento", claves: ["descuento curso"] });
    const a = armar(mala);
    const r = (await manejarConsultaAdmin("3: dile que sí hay descuento", undefined, a.ops)) ?? "";
    assert.ok(r.startsWith("No pude armar la respuesta con seguridad") && r.includes("3: enviar:"), r);
    assert.equal(a.e.enviados.length, 0); assert.equal(a.e.saber.length, 0); assert.equal(a.e.consultas.length, 1);
    assert.equal(leerRedaccion(mala, CONTEXTO, "dile que sí hay 20% de descuento y cuesta $350.000")?.tipo, "listo", "si el dueño lo dijo, sí vale");
  });
  await caso("Sin IA (null) o salida rota: se pide el texto completo", async () => {
    for (const s of [null, "no es json", "{}", JSON.stringify({ estado: "listo", respuesta: "ok", titulo: "x", claves: ["abc"] })]) {
      const a = armar(s);
      assert.ok(((await manejarConsultaAdmin("3: dile que sí", undefined, a.ops)) ?? "").startsWith("No pude armar"), String(s));
      assert.equal(a.e.enviados.length, 0);
    }
  });
  await caso("'N: enviar: texto' lo manda tal cual, sin IA y sin guardarlo", async () => {
    const a = armar(null);
    const r = (await manejarConsultaAdmin("3: enviar: Hola, sí se puede en cuotas. Escríbenos y lo vemos.", undefined, a.ops)) ?? "";
    assert.ok(r.startsWith("✅ Envié tu texto") && r.includes("No lo guardé"), r);
    assert.deepEqual(a.e.enviados, ["Hola, sí se puede en cuotas. Escríbenos y lo vemos."]);
    assert.equal(a.e.ia, 0); assert.equal(a.e.saber.length, 0); assert.equal(a.e.consultas.length, 0);
  });
  await caso("'N: descartar' cierra sin enviar nada", async () => {
    const a = armar(LISTO);
    const r = (await manejarConsultaAdmin("3: descartar", undefined, a.ops)) ?? "";
    assert.ok(r.includes("cerré la consulta #3"));
    assert.equal(a.e.enviados.length, 0); assert.equal(a.e.consultas.length, 0);
  });
  await caso("Pasadas las 24 h WhatsApp rechaza el envío: se avisa y la consulta sigue abierta, sin guardar nada", async () => {
    const a = armar(LISTO, false);
    const r = (await manejarConsultaAdmin("3: dile que sí, el saldo en cuotas", undefined, a.ops)) ?? "";
    assert.ok(r.includes("24 horas") && r.includes("sigue abierta"), r);
    assert.equal(a.e.consultas.length, 1); assert.equal(a.e.saber.length, 0);
  });
  await caso("'consultas', 'saber' y 'olvidar N'", async () => {
    const a = armar(LISTO);
    assert.ok(((await manejarConsultaAdmin("consultas", undefined, a.ops)) ?? "").includes("#3: «¿Puedo pagar el curso"));
    assert.equal(await manejarConsultaAdmin("saber", undefined, a.ops), "Todavía no he guardado respuestas desde el chat.");
    await manejarConsultaAdmin("3: dile que sí, el saldo en cuotas", undefined, a.ops);
    assert.ok(((await manejarConsultaAdmin("saber", undefined, a.ops)) ?? "").includes("1. Pago del curso en cuotas"));
    assert.equal(await manejarConsultaAdmin("olvidar 1", undefined, a.ops), "Listo, olvidé «Pago del curso en cuotas».");
    assert.equal(a.e.saber.length, 0);
    assert.ok(((await manejarConsultaAdmin("olvidar 5", undefined, a.ops)) ?? "").startsWith("No encuentro"));
    assert.equal(await manejarConsultaAdmin("consultas", undefined, a.ops), "No hay consultas pendientes.");
  });
  await caso("Imagen del cliente: 'N: confirmado' pide las fotos y deja la consulta abierta; 'N: listo' la cierra; nada se guarda", async () => {
    const a = armar(LISTO); a.e.consultas[0].tipo = "imagen";
    const av = avisoDeImagen(3);
    assert.ok(av.includes("3: confirmado") && av.includes("3: listo") && avisoDeImagen(3, true).includes("otra imagen"));
    const r = (await manejarConsultaAdmin("3: confirmado", undefined, a.ops)) ?? "";
    assert.ok(r.startsWith("✅ Confirmé el abono") && r.includes("3: listo"), r);
    assert.deepEqual(a.e.enviados, [TEXTO_ABONO_OK]);
    assert.ok(TEXTO_ABONO_OK.includes("2 fotos de referencia") && TEXTO_ABONO_OK.includes("fotos de tu cabello"));
    assert.equal(a.e.consultas.length, 1, "sigue abierta para reenviar las fotos"); assert.equal(a.e.saber.length, 0); assert.equal(a.e.ia, 0);
    assert.ok(((await manejarConsultaAdmin("Confirmado", "wamid.AVISO", a.ops)) ?? "").startsWith("✅ Confirmé"), "citando la imagen también");
    assert.ok(((await manejarConsultaAdmin("3: listo", undefined, a.ops)) ?? "").startsWith("Listo, cerré la consulta #3"));
    assert.equal(a.e.consultas.length, 0);
  });
  await caso("Respuesta con IA a una imagen: se envía pero NO se guarda como conocimiento", async () => {
    const a = armar(LISTO); a.e.consultas[0].tipo = "imagen";
    const r = (await manejarConsultaAdmin("3: dile que aún no vemos el abono, el abono de $100.000", undefined, a.ops)) ?? "";
    assert.ok(r.startsWith("✅ Respondí") && r.includes("No la guardé"), r);
    assert.equal(a.e.enviados.length, 1); assert.equal(a.e.saber.length, 0);
  });
  await caso("leerRedaccion: respuestas largas, sin claves o con datos personales se rechazan", async () => {
    const ok = { estado: "listo", respuesta: "Sí, el saldo se puede pagar en cuotas.", titulo: "Cuotas", claves: ["cuotas curso"] };
    assert.equal(leerRedaccion(JSON.stringify(ok), CONTEXTO, "")?.tipo, "listo");
    assert.equal(leerRedaccion(JSON.stringify({ ...ok, respuesta: "x".repeat(601) }), CONTEXTO, ""), null);
    assert.equal(leerRedaccion(JSON.stringify({ ...ok, claves: [] }), CONTEXTO, ""), null);
    assert.equal(leerRedaccion(JSON.stringify({ ...ok, respuesta: "Escríbele a juan@correo.cl" }), CONTEXTO, ""), null);
    assert.equal(leerRedaccion(JSON.stringify({ ...ok, claves: ["me llamo juan@correo.cl", "cuotas"] }), CONTEXTO, "")?.tipo, "listo", "la clave con correo se descarta, queda la limpia");
    assert.equal(leerRedaccion(undefined, CONTEXTO, ""), null);
  });
  await caso("Respuestas propias de trabajos químicos: gana la clave más específica y no se mezclan", async () => {
    const L = (id: string, claves: string[], respuesta: string) => ({ id, claves, respuesta });
    const lista = [L("v", ["visos", "mechas"], "VISOS"), L("c", ["color global", "tinte"], "COLOR"), L("r", ["rizo permanente", "rizos", "rizo"], "RIZO"), L("a", ["reservar visos", "reservar color global", "agendar visos"], "ABONO")];
    const r = (m: string) => responderPersonalizadas(normalizar(m), lista as any);
    assert.equal(r("Hacen visos?"), "VISOS"); assert.equal(r("cuál es el valor del color global?"), "COLOR");
    assert.equal(r("quiero reservar visos"), "ABONO", "solo el abono, sin los visos"); assert.equal(r("quiero reservar color global"), "ABONO");
    assert.equal(r("qué largo necesito para un rizo permanente"), "RIZO"); assert.equal(r("hola"), null);
    assert.equal(r("cuánto cuestan los visos y el color global"), "COLOR\n\nVISOS", "si preguntan por dos, responde las dos");
  });
  const conBorradores = (salida: string | null) => {
    const a = armar(salida), pend = new Map<number, any>();
    a.ops.borradores = { guardar: async (b) => { pend.set(b.numero, b); return true; }, tomar: async (n) => { const b = pend.get(n) ?? null; pend.delete(n); return b; } };
    return { ...a, pend };
  };
  const ids = (t: string) => (botonesDeConsulta(t) ?? []).map((b) => b.id);
  await caso("Aviso al dueño con botones; 'Sugerir con IA' deja un borrador sin enviar", async () => {
    assert.deepEqual(ids(avisoDeConsulta({ numero: 3, pregunta: "¿Hay cuotas?" })), ["cq_sugerir_3", "cq_descartar_3"]);
    const a = conBorradores(LISTO);
    const r = (await manejarConsultaAdmin("cq_sugerir_3", undefined, a.ops)) ?? "";
    assert.deepEqual(ids(r), ["cq_aprobar_3", "cq_soloenviar_3", "cq_cancelar_3"], r);
    assert.equal(a.e.enviados.length, 0); assert.equal(a.e.consultas[0].notas, null);
  });
  await caso("Borrador: 'Enviar y guardar' envía una sola vez y guarda", async () => {
    const a = conBorradores(LISTO);
    assert.ok(((await manejarConsultaAdmin("3: dile que sí, el saldo en cuotas", undefined, a.ops)) ?? "").startsWith("📝 Borrador"));
    assert.equal(a.e.enviados.length, 0);
    assert.ok(((await manejarConsultaAdmin("cq_aprobar_3", undefined, a.ops)) ?? "").includes("La guardé"));
    assert.ok(((await manejarConsultaAdmin("cq_aprobar_3", undefined, a.ops)) ?? "").includes("no tiene nada pendiente"));
    assert.equal(a.e.enviados.length, 1); assert.equal(a.e.saber.length, 1); assert.equal(a.e.consultas.length, 0);
  });
  await caso("Borrador: 'Solo enviar' no guarda; 'Cancelar' no envía; sin 24 h se conserva", async () => {
    const a = conBorradores(LISTO);
    await manejarConsultaAdmin("3: dile que sí, el saldo en cuotas", undefined, a.ops);
    assert.ok(((await manejarConsultaAdmin("cq_cancelar_3", undefined, a.ops)) ?? "").includes("no envié nada"));
    assert.equal(a.e.consultas.length, 1); assert.equal(a.e.enviados.length, 0);
    await manejarConsultaAdmin("3: dile que sí, el saldo en cuotas", undefined, a.ops);
    await manejarConsultaAdmin("3: solo enviar", undefined, a.ops);
    assert.equal(a.e.enviados.length, 1); assert.equal(a.e.saber.length, 0);
    const b = conBorradores(LISTO); b.ops.enviarAlCliente = async () => false;
    await manejarConsultaAdmin("3: dile que sí, el saldo en cuotas", undefined, b.ops);
    assert.ok(((await manejarConsultaAdmin("cq_aprobar_3", undefined, b.ops)) ?? "").includes("24 horas")); assert.equal(b.pend.size, 1);
  });
  await caso("Texto propio: se envía al tiro y pregunta si guardar (con o sin IA)", async () => {
    for (const salida of [LISTO, null]) {
      const a = conBorradores(salida);
      const r = (await manejarConsultaAdmin("3: enviar: Sí, se puede pagar en cuotas.", undefined, a.ops)) ?? "";
      assert.deepEqual(ids(r), ["cq_guardar_3", "cq_noguardar_3"], r); assert.equal(a.e.enviados.length, 1);
      assert.ok(((await manejarConsultaAdmin("cq_guardar_3", undefined, a.ops)) ?? "").includes("La guardé"));
      assert.equal(a.e.saber[0].respuesta, "Sí, se puede pagar en cuotas."); assert.equal(a.e.enviados.length, 1);
    }
    const b = conBorradores(null);
    await manejarConsultaAdmin("3: enviar: Voy en seguida.", undefined, b.ops);
    assert.ok(((await manejarConsultaAdmin("3: no guardar", undefined, b.ops)) ?? "").startsWith("Ok, no guardé"));
    assert.equal(b.e.saber.length, 0);
  });
  console.log(`OK ${casos} casos de consultas difíciles; sin red, base ni llaves.`);
})().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
