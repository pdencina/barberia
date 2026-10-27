import { createHash, createHmac, timingSafeEqual } from "node:crypto";

// DESCONOCIDO: contrato GENÉRICO, pendiente de validar contra Meta; no conectar aún.
// Consulta oficial 2026-10-27: payload inaccesible, plantillas y desafío HTTP 429.
// https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/payload-examples
// https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-message-templates
// https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/create-webhook-endpoint
// Las cotas de abajo son defensas locales, no límites documentados de Meta.
export const LIMITE_TEXTO_EN_MEMORIA = 16_384;
export type ResultadoEnvioPlantilla = { estado: "aceptado"; id: string } | { estado: "fallido" | "incierto" };
export interface ParametrosPlantilla {
  para: string;
  plantilla: string;
  idioma: string;
  variables: readonly string[];
}
export interface DependenciasWhatsAppMeta {
  fetch: (url: string, opciones: RequestInit) => Promise<{ status: number; json: () => Promise<unknown> }>;
  token: string;
  version: string;
  phone_number_id: string;
}
// Mismo namespace del extractor y de las bajas; el llamador valida/canoniza sin inferir país.
export function hashContactoWhatsApp(sal: string, tenantId: string, remitenteCanonico: string): string {
  return createHmac("sha256", sal).update(JSON.stringify(["agente:contacto:v1", tenantId, remitenteCanonico])).digest("hex");
}

const objeto = (valor: unknown): valor is Record<string, unknown> =>
  typeof valor === "object" && valor !== null && !Array.isArray(valor);
const campo = (valor: unknown, nombre: string): unknown =>
  objeto(valor) && Object.prototype.hasOwnProperty.call(valor, nombre) ? valor[nombre] : undefined;
const identificador = (valor: unknown): valor is string =>
  typeof valor === "string" && valor.length > 0 && valor.length <= 1024 && valor.trim() === valor && !/[\u0000-\u001f\u007f]/.test(valor);
const numero = (valor: unknown): valor is string => typeof valor === "string" && /^[0-9]{1,32}$/.test(valor);

// Sin valores por defecto ni acceso a fetch global/entorno. Una llamada, nunca reintenta.
export async function enviarPlantilla(args: ParametrosPlantilla, deps: DependenciasWhatsAppMeta): Promise<ResultadoEnvioPlantilla> {
  let url: string, opciones: RequestInit;
  try {
    if (!deps || typeof deps.fetch !== "function" || typeof deps.token !== "string" || !deps.token.trim() || /[\r\n]/.test(deps.token)
      || !/^v[0-9]+\.[0-9]+$/.test(deps.version) || !numero(deps.phone_number_id)
      || !args || !numero(args.para) || !/^[a-z0-9_]{1,512}$/.test(args.plantilla)
      || !/^[a-z]{2,3}(?:_[A-Z]{2})?$/.test(args.idioma) || !Array.isArray(args.variables)
      || args.variables.length > 100 || args.variables.some(v => typeof v !== "string" || v.length > LIMITE_TEXTO_EN_MEMORIA)) return { estado: "fallido" };
    const template = {
      name: args.plantilla, language: { code: args.idioma },
      ...(args.variables.length ? { components: [{ type: "body", parameters: args.variables.map(text => ({ type: "text", text })) }] } : {}),
    };
    url = `https://graph.facebook.com/${deps.version}/${deps.phone_number_id}/messages`;
    opciones = {
      method: "POST", redirect: "error", headers: { Authorization: `Bearer ${deps.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", to: args.para, type: "template", template }),
    };
  } catch { return { estado: "fallido" }; } // No se invocó al proveedor.
  return enviarPeticionMeta(url, opciones, deps);
}

async function enviarPeticionMeta(url: string, opciones: RequestInit, deps: DependenciasWhatsAppMeta): Promise<ResultadoEnvioPlantilla> {
  try {
    const respuesta = await deps.fetch(url, opciones);
    if (!Number.isInteger(respuesta.status)) return { estado: "incierto" };
    // Contrato genérico: solo estos rechazos explícitos se consideran definitivos.
    // Timeout/408, conflicto/409 y cualquier estado desconocido quedan inciertos.
    if ([400, 401, 403, 404, 405, 413, 415, 422, 429].includes(respuesta.status)) return { estado: "fallido" };
    if (respuesta.status < 200 || respuesta.status >= 300) return { estado: "incierto" };
    const data = await respuesta.json();
    if (campo(data, "error") !== undefined) return { estado: "incierto" };
    const mensajes = campo(data, "messages");
    const id = Array.isArray(mensajes) && mensajes.length === 1 ? campo(mensajes[0], "id") : undefined;
    return identificador(id) ? { estado: "aceptado", id } : { estado: "incierto" };
  } catch { return { estado: "incierto" }; } // Incluye timeout, red, JSON perdido: no reenviar a ciegas.
}

export function resolverDesafioWebhook(query: unknown, tokenEsperado: unknown): string | null {
  try {
    const obtener = (nombre: string): unknown => {
      if (query instanceof URLSearchParams) {
        const valores = query.getAll(nombre);
        return valores.length === 1 ? valores[0] : undefined;
      }
      return campo(query, nombre);
    };
    const token = obtener("hub.verify_token"), modo = obtener("hub.mode"), desafio = obtener("hub.challenge");
    if (typeof token !== "string" || typeof tokenEsperado !== "string" || !token.trim() || !tokenEsperado.trim()
      || token.length > 4096 || tokenEsperado.length > 4096) return null;
    // Compara digests de longitud fija incluso cuando las longitudes del token difieren.
    const valido = timingSafeEqual(createHash("sha256").update(token).digest(), createHash("sha256").update(tokenEsperado).digest());
    return valido && modo === "subscribe" && typeof desafio === "string" && desafio.length > 0 && desafio.length <= 4096 ? desafio : null;
  } catch { return null; }
}

export interface MensajeEntrantePersistible {
  readonly id: string;
  readonly tipo: string;
  readonly phone_number_id: string;
  readonly remitenteHash: string;
  readonly context_id?: string;
  readonly tipo_respuesta?: "button_reply" | "list_reply";
}
const textos = new WeakMap<TextoEntranteEnMemoria, string | null>();
const remitentes = new WeakMap<TextoEntranteEnMemoria, string | null>();
// Sin propiedades propias: JSON, spread e inspección no exponen el texto.
// leerTexto() es una salida explícita solo para clasificación; nunca persistirla.
export class TextoEntranteEnMemoria {
  constructor(texto: string | null, remitente: string | null = null) { textos.set(this, texto); remitentes.set(this, remitente); Object.freeze(this); }
  leerTexto(): string | null { return textos.get(this) ?? null; }
  leerRemitente(): string | null { return remitentes.get(this) ?? null; }
  toJSON(): undefined { return undefined; }
}
export interface MensajeEntranteExtraido {
  readonly persistible: MensajeEntrantePersistible;
  readonly memoria: TextoEntranteEnMemoria;
}

// El llamador debe verificar la firma ANTES de extraer y aportar el mapa autorizado de negocios.
export interface ContextoHashRemitente {
  sal: string;
  // Resolver mediante configuración ya cargada; sin base/red dentro del extractor.
  resolverTenant: (phone_number_id: string) => string | null;
}
export function extraerMensajesEntrantes(payload: unknown, contexto: ContextoHashRemitente): MensajeEntranteExtraido[] {
  if (!contexto || typeof contexto.sal !== "string" || !contexto.sal.trim() || contexto.sal.length > 4096
    || typeof contexto.resolverTenant !== "function") return [];
  const resultado: MensajeEntranteExtraido[] = [];
  try {
    if (campo(payload, "object") !== "whatsapp_business_account") return [];
    const entradas = campo(payload, "entry");
    if (!Array.isArray(entradas)) return [];
    for (const entrada of entradas) {
      const cambios = campo(entrada, "changes");
      if (!Array.isArray(cambios)) continue;
      for (const cambio of cambios) {
        if (campo(cambio, "field") !== "messages") continue;
        const valor = campo(cambio, "value");
        if (campo(valor, "messaging_product") !== "whatsapp") continue;
        const phoneId = campo(campo(valor, "metadata"), "phone_number_id"), mensajes = campo(valor, "messages");
        if (!numero(phoneId) || !Array.isArray(mensajes)) continue;
        const tenantId = contexto.resolverTenant(phoneId);
        if (!identificador(tenantId)) continue;
        for (const mensaje of mensajes) {
          const id = campo(mensaje, "id"), tipo = campo(mensaje, "type"), remitente = campo(mensaje, "from");
          if (!identificador(id) || typeof tipo !== "string" || !/^[a-z_]{1,64}$/.test(tipo) || !numero(remitente)) continue;
          const contextId = campo(campo(mensaje, "context"), "id");
          const interactive = campo(mensaje, "interactive");
          const subtipo = campo(interactive, "type");
          const tipoRespuesta = tipo === "interactive" && (subtipo === "button_reply" || subtipo === "list_reply") ? subtipo : undefined;
          const texto = tipo === "text" ? campo(campo(mensaje, "text"), "body")
            : tipo === "button" ? campo(campo(mensaje, "button"), "payload")
            : tipoRespuesta ? campo(campo(interactive, tipoRespuesta), "id") : undefined;
          // Dominio estable para bajas por tenant aunque cambie el número del negocio.
          // No reutiliza clave-deduplicacion: aquella no es HMAC ni identifica contactos.
          const remitenteHash = hashContactoWhatsApp(contexto.sal, tenantId, remitente);
          resultado.push(Object.freeze({
            persistible: Object.freeze({ id, tipo, phone_number_id: phoneId, remitenteHash,
              ...(identificador(contextId) ? { context_id: contextId } : {}),
              ...(tipoRespuesta ? { tipo_respuesta: tipoRespuesta } : {}) }),
            memoria: new TextoEntranteEnMemoria(typeof texto === "string" && texto.length <= LIMITE_TEXTO_EN_MEMORIA ? texto : null, remitente),
          }));
        }
      }
    }
    return resultado;
  } catch { return []; } // Entradas que no son JSON plano fallan cerrado, sin eco de datos.
}

// Respuesta a mensaje entrante: mismo contrato genérico/pendiente de validación oficial.
// El texto se transporta, no se registra; se invoca solo después de verificar el resultado.
export async function enviarTexto(args: { para: string; texto: string }, deps: DependenciasWhatsAppMeta): Promise<ResultadoEnvioPlantilla> {
  try {
    if (!deps || typeof deps.fetch !== "function" || typeof deps.token !== "string" || !deps.token.trim() || /[\r\n]/.test(deps.token)
      || !/^v[0-9]+\.[0-9]+$/.test(deps.version) || !numero(deps.phone_number_id)
      || !args || !numero(args.para) || typeof args.texto !== "string" || !args.texto.trim() || args.texto.length > LIMITE_TEXTO_EN_MEMORIA) return { estado: "fallido" };
    return enviarPeticionMeta(`https://graph.facebook.com/${deps.version}/${deps.phone_number_id}/messages`, {
      method: "POST", redirect: "error", headers: { Authorization: `Bearer ${deps.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", to: args.para, type: "text", text: { body: args.texto } }),
    }, deps);
  } catch { return { estado: "fallido" }; }
}
