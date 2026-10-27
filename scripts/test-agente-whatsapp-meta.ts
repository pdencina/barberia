// Solo datos sintéticos, fetch simulado; nunca entorno, red ni base.
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { inspect } from "node:util";
import { enviarPlantilla, resolverDesafioWebhook, extraerMensajesEntrantes, LIMITE_TEXTO_EN_MEMORIA, type DependenciasWhatsAppMeta, type ParametrosPlantilla } from "../src/lib/agente/whatsapp-meta";
let casos = 0;
function check(nombre: string, condicion: boolean) { casos++; assert.equal(condicion, true, nombre); }
const token = "token_sintetico_pruebas", telefono = "10000000001", sal = "sal_sintetica_para_pruebas";
const args: ParametrosPlantilla = { para: telefono, plantilla: "informe_diario", idioma: "es_CL", variables: ["dato sintético"] };
const contexto = { sal, resolverTenant: (_id: string) => "tenant-sintetico" };
const mensaje = (overrides: Record<string, unknown> = {}) => ({ id: "wamid.sintetico", type: "text", from: telefono, text: { body: "texto privado sintético" }, ...overrides });
const payload = (mensajes: unknown = [mensaje()], metadata: unknown = { phone_number_id: "1001" }) => ({ object: "whatsapp_business_account", entry: [{ changes: [{ field: "messages", value: { messaging_product: "whatsapp", metadata, messages: mensajes, contacts: [{ name: "nombre omitido" }], statuses: [{ status: "delivered" }] } }] }] });
const desafio = { "hub.mode": "subscribe", "hub.verify_token": token, "hub.challenge": "desafio-sintetico" };

async function main() {
  const logs: unknown[][] = [];
  const originales = { log: console.log, warn: console.warn, error: console.error, info: console.info, debug: console.debug };
  for (const metodo of Object.keys(originales) as (keyof typeof originales)[]) console[metodo] = (...items: unknown[]) => { logs.push(items); };
  try {
    let llamadas = 0, ultimaUrl = "", ultimasOpciones: RequestInit = {};
    const deps: DependenciasWhatsAppMeta = { token, version: "v99.0", phone_number_id: "1001", fetch: async (url, opciones) => {
      llamadas++; ultimaUrl = url; ultimasOpciones = opciones;
      return { status: 200, json: async () => ({ messages: [{ id: "wamid.aceptado" }] }) };
    } };
    const ok = await enviarPlantilla(args, deps);
    check("aceptado con id", ok.estado === "aceptado" && ok.id === "wamid.aceptado");
    check("una sola solicitud", llamadas === 1);
    check("endpoint parametrizado", ultimaUrl === "https://graph.facebook.com/v99.0/1001/messages");
    check("POST", ultimasOpciones.method === "POST");
    check("no sigue redirects con token", ultimasOpciones.redirect === "error");
    check("token solo en cabecera", (ultimasOpciones.headers as Record<string, string>).Authorization === `Bearer ${token}` && !ultimaUrl.includes(token) && !String(ultimasOpciones.body).includes(token));
    const enviado = JSON.parse(ultimasOpciones.body as string);
    check("producto y destinatario", enviado.messaging_product === "whatsapp" && enviado.to === telefono && enviado.type === "template");
    check("nombre idioma variables", enviado.template.name === args.plantilla && enviado.template.language.code === args.idioma && enviado.template.components[0].parameters[0].text === args.variables[0]);
    await enviarPlantilla({ ...args, variables: [] }, deps);
    check("sin variables omite componentes", !JSON.parse(ultimasOpciones.body as string).template.components);
    for (const status of [400, 401, 403, 404, 405, 413, 415, 422, 429, 408, 409, 425, 500, 502, 503, 504, 301, 0, NaN]) {
      let count = 0;
      const r = await enviarPlantilla(args, { ...deps, fetch: async () => { count++; return { status, json: async () => { throw Error("no debe leer errores"); } }; } });
      check(`estado HTTP ${status}`, r.estado === ([400, 401, 403, 404, 405, 413, 415, 422, 429].includes(status) ? "fallido" : "incierto"));
      check(`sin reintento HTTP ${status}`, count === 1);
    }
    for (const data of [null, {}, [], { messages: [] }, { messages: [{ id: "" }] }, { messages: [{ id: 1 }] }, { messages: [{ id: "a" }, { id: "b" }] }, { messages: [{ id: " id " }] }, { messages: [{ id: "a\n" }] }, { messages: [{ id: "x".repeat(1025) }] }, { messages: [{ id: "a" }], error: {} }]) {
      check("respuesta sin aceptación inequívoca", (await enviarPlantilla(args, { ...deps, fetch: async () => ({ status: 200, json: async () => data }) })).estado === "incierto");
    }
    for (const status of [201, 202, 204, 299]) check("otro 2xx con id", (await enviarPlantilla(args, { ...deps, fetch: async () => ({ status, json: async () => ({ messages: [{ id: "a" }] }) }) })).estado === "aceptado");
    check("status NaN con id sigue incierto", (await enviarPlantilla(args, { ...deps, fetch: async () => ({ status: NaN, json: async () => ({ messages: [{ id: "a" }] }) }) })).estado === "incierto");
    check("respuesta JSON perdida", (await enviarPlantilla(args, { ...deps, fetch: async () => ({ status: 200, json: async () => { throw Error(token); } }) })).estado === "incierto");
    for (const error of [new Error(token), Object.assign(new Error("timeout"), { name: "AbortError" }), null]) check("excepción del transporte", (await enviarPlantilla(args, { ...deps, fetch: async () => { throw error; } })).estado === "incierto");
    for (const parcial of [{ token: "" }, { token: " " }, { token: "a\nb" }, { version: "../" }, { version: "" }, { phone_number_id: "../" }, { phone_number_id: "" }, { fetch: undefined }]) {
      llamadas = 0;
      check("dependencia inválida", (await enviarPlantilla(args, { ...deps, ...parcial } as DependenciasWhatsAppMeta)).estado === "fallido");
      check("validación previa sin fetch", llamadas === 0);
    }
    for (const parcial of [{ para: "" }, { para: "+123" }, { para: "1/2" }, { plantilla: "" }, { plantilla: "Mala" }, { idioma: "" }, { idioma: "es-CL" }, { variables: null }, { variables: [1] }, { variables: Array(101).fill("x") }, { variables: ["x".repeat(LIMITE_TEXTO_EN_MEMORIA + 1)] }]) {
      llamadas = 0;
      check("argumentos inválidos", (await enviarPlantilla({ ...args, ...parcial } as ParametrosPlantilla, deps)).estado === "fallido");
      check("argumentos inválidos sin fetch", llamadas === 0);
    }
    check("desafío válido", resolverDesafioWebhook(desafio, token) === "desafio-sintetico");
    check("query URLSearchParams", resolverDesafioWebhook(new URLSearchParams(desafio), token) === "desafio-sintetico");
    for (const esperado of ["", " ", null, undefined, 4, {}, "otro", "t".repeat(5000)]) check("token esperado inválido", resolverDesafioWebhook(desafio, esperado) === null);
    for (const parcial of [{ "hub.mode": "" }, { "hub.mode": "otro" }, { "hub.verify_token": "" }, { "hub.verify_token": [] }, { "hub.verify_token": token + " " }, { "hub.challenge": "" }, { "hub.challenge": null }, { "hub.challenge": 42 }, { "hub.challenge": "a".repeat(4097) }]) check("query inválida", resolverDesafioWebhook({ ...desafio, ...parcial }, token) === null);
    for (const q of [null, {}, [], 1, Object.create(desafio)]) check("query malformada", resolverDesafioWebhook(q, token) === null);
    const duplicado = new URLSearchParams(desafio); duplicado.append("hub.verify_token", token);
    check("token duplicado rechazado", resolverDesafioWebhook(duplicado, token) === null);
    check("desafío cero string", resolverDesafioWebhook({ ...desafio, "hub.challenge": "0" }, token) === "0");

    const extraidos = extraerMensajesEntrantes(payload(), contexto), primero = extraidos[0];
    check("extrae un mensaje", extraidos.length === 1);
    check("metadatos mínimos", Object.keys(primero.persistible).sort().join(",") === "id,phone_number_id,remitenteHash,tipo");
    check("identidad y tipo", primero.persistible.id === "wamid.sintetico" && primero.persistible.tipo === "text" && primero.persistible.phone_number_id === "1001");
    check("hash exacto con dominio y tenant", primero.persistible.remitenteHash === createHmac("sha256", sal).update(JSON.stringify(["agente:contacto:v1", "tenant-sintetico", telefono])).digest("hex"));
    check("texto disponible explícitamente", primero.memoria.leerTexto() === "texto privado sintético");
    const serializado = JSON.stringify(extraidos);
    for (const secreto of [telefono, token, sal, "texto privado sintético", "nombre omitido"]) check("JSON sin dato sensible", !serializado.includes(secreto));
    check("memoria no serializa", JSON.stringify(primero.memoria) === undefined);
    check("memoria sin propiedades", Object.keys(primero.memoria).length === 0 && JSON.stringify({ ...primero.memoria }) === "{}");
    check("inspect no expone texto", !inspect(extraidos, { showHidden: true }).includes("texto privado sintético"));
    check("inmutable", Object.isFrozen(primero) && Object.isFrozen(primero.persistible) && Object.isFrozen(primero.memoria));
    check("mismo hash repetido", extraerMensajesEntrantes(payload(), contexto)[0].persistible.remitenteHash === primero.persistible.remitenteHash);
    check("sal distinta", extraerMensajesEntrantes(payload(), { ...contexto, sal: "otra" })[0].persistible.remitenteHash !== primero.persistible.remitenteHash);
    check("tenant distinto", extraerMensajesEntrantes(payload(), { ...contexto, resolverTenant: () => "otro" })[0].persistible.remitenteHash !== primero.persistible.remitenteHash);
    check("número negocio nuevo conserva baja", extraerMensajesEntrantes(payload([mensaje()], { phone_number_id: "2002" }), contexto)[0].persistible.remitenteHash === primero.persistible.remitenteHash);
    check("negocio desconocido omitido", extraerMensajesEntrantes(payload(), { ...contexto, resolverTenant: () => null }).length === 0);
    for (const s of ["", " ", null, 1, "s".repeat(4097)]) check("sal inválida", extraerMensajesEntrantes(payload(), { ...contexto, sal: s } as typeof contexto).length === 0);
    for (const tipo of ["image", "audio", "sticker", "video", "document", "location", "contacts", "interactive", "unsupported"]) {
      const [m] = extraerMensajesEntrantes(payload([mensaje({ type: tipo, [tipo]: { body: "contenido prohibido" } })]), contexto);
      check(`tipo ${tipo}`, m.persistible.tipo === tipo && m.memoria.leerTexto() === null);
      check(`tipo ${tipo} sin contenido`, !JSON.stringify(m).includes("contenido prohibido"));
    }
    for (const texto of ["", "á 🧪", "x".repeat(LIMITE_TEXTO_EN_MEMORIA)]) check("texto en cota", extraerMensajesEntrantes(payload([mensaje({ text: { body: texto } })]), contexto)[0].memoria.leerTexto() === texto);
    check("texto enorme omitido", extraerMensajesEntrantes(payload([mensaje({ text: { body: "x".repeat(2_000_000) } })]), contexto)[0].memoria.leerTexto() === null);
    for (const text of [null, {}, { body: 1 }, { body: null }]) check("texto malformado sin contenido", extraerMensajesEntrantes(payload([mensaje({ text })]), contexto)[0].memoria.leerTexto() === null);
    check("varios mensajes", extraerMensajesEntrantes(payload([mensaje(), mensaje({ id: "wamid.otro" })]), contexto).length === 2);
    const varios = payload(); varios.entry.push(payload().entry[0]);
    check("varias entradas", extraerMensajesEntrantes(varios, contexto).length === 2);
    check("estados no mensajes", extraerMensajesEntrantes(payload(undefined), contexto).length === 1 && extraerMensajesEntrantes(payload(null), contexto).length === 0);
    const soloEstados = payload(); delete (soloEstados.entry[0].changes[0].value as { messages?: unknown }).messages;
    check("solo estados omitidos", extraerMensajesEntrantes(soloEstados, contexto).length === 0);
    for (const mal of [null, undefined, {}, [], 3, { object: "otro" }, { object: "whatsapp_business_account", entry: {} }, { object: "whatsapp_business_account", entry: [null, {}, { changes: [null, {}] }] }]) check("payload malformado", extraerMensajesEntrantes(mal, contexto).length === 0);
    for (const metadata of [null, {}, { phone_number_id: "" }, { phone_number_id: 1 }, { phone_number_id: "1/2" }]) check("metadata malformada", extraerMensajesEntrantes(payload([mensaje()], metadata), contexto).length === 0);
    for (const cambio of [{ field: "statuses" }, { value: { messaging_product: "otro" } }]) {
      const p = payload(); Object.assign(p.entry[0].changes[0], cambio);
      check("campo o producto ignorado", extraerMensajesEntrantes(p, contexto).length === 0);
    }
    for (const parcial of [{ id: "" }, { id: 1 }, { type: "" }, { type: "TEXT" }, { from: "" }, { from: "+123" }, { from: null }]) check("mensaje inválido", extraerMensajesEntrantes(payload([mensaje(parcial)]), contexto).length === 0);
    check("mensaje inválido no pierde válido", extraerMensajesEntrantes(payload([null, {}, mensaje()]), contexto).length === 1);
    const original = payload(), antes = JSON.stringify(original); extraerMensajesEntrantes(original, contexto);
    check("sin mutar payload", JSON.stringify(original) === antes);
    check("resolver lanza falla cerrado", extraerMensajesEntrantes(payload(), { ...contexto, resolverTenant: () => { throw Error(token); } }).length === 0);
    check("ninguna salida de biblioteca", logs.length === 0);
  } finally {
    Object.assign(console, originales);
  }
  console.log(`OK: ${casos} casos cliente WhatsApp GENÉRICO; sin red/base/entorno ni salida de datos sensibles.`);
}
main().catch(() => { console.error("FALLO: prueba del cliente genérico; detalles sensibles omitidos."); process.exitCode = 1; });
