// Resumen del agente para el dueño: qué conversaciones esperan a una persona, cuáles no se entendieron, confirmaciones y consultas.
// Determinista (sin IA), sobre las conversaciones guardadas. Se usa en la pantalla de conversaciones y en el comando «resumen».
import { ahoraChile } from "./disponibilidad";

/** Marca que deja el botón «Cerrar caso»: la conversación deja de esperar a una persona. */
export const MARCA_CERRADO = "[cerrado]";
export type Etiqueta = "persona" | "confuso" | "confirmacion" | "consulta";
export interface MensajeResumen { contact_hash: string; direccion: "entrante" | "saliente"; tipo: string; texto: string; created_at: string }
export interface Conteos {
  conversaciones: number; persona: number; confuso: number; confirmacion: number; consulta: number;
  confirmacionesEnviadas: number; confirmadas: number; canceladas: number;
}

const DERIVA = /te atiende una persona|te contactará una persona|una persona te contactará|una persona del equipo la revisa|déjame confirmarlo con el equipo|escribirle a una persona del equipo/i;
/** Con estas, mientras la consulta siga abierta hay alguien esperando (aunque el agente le haya seguido respondiendo). */
const NO_ENTENDI = /^no entendí/i;
const PIDE_CONFIRMAR = /te escribimos desde|aún no recibimos tu confirmación/i;
const CONFIRMADA = /^tu cita está confirmada/i;
const CANCELADA = /^tu cita está cancelada/i;
const SOLO_CONFIRMA = /^\W*(s[ií]|ok|oka|dale|ya|confirmo( mi cita)?|confirmado|gracias|muchas gracias)\W*$/i;
const PLAZO_PERSONA_MS = 48 * 3600000;

/** Etiquetas de una conversación. `mensajes` en cualquier orden; `dia` limita a lo de ese día (hora de Chile). */
export function etiquetasDe(mensajes: MensajeResumen[], consultaAbierta: boolean, ahora: number, dia?: string): Etiqueta[] {
  const orden = [...mensajes].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const delDia = dia ? orden.filter((m) => ahoraChile(Date.parse(m.created_at)).fecha === dia) : orden;
  const e = new Set<Etiqueta>();
  // Espera a una persona: consulta abierta, o una derivación reciente que nadie ha contestado a mano.
  let pendiente = false;
  for (const m of orden) {
    if (m.direccion !== "saliente") continue;
    if (m.texto.startsWith("[manual] ") || m.texto === MARCA_CERRADO) pendiente = false;
    else if (DERIVA.test(m.texto) && ahora - Date.parse(m.created_at) < PLAZO_PERSONA_MS) pendiente = true;
  }
  if (pendiente || consultaAbierta) e.add("persona");
  for (const m of delDia) {
    if (m.direccion === "saliente") {
      if (NO_ENTENDI.test(m.texto)) e.add("confuso");
      if (PIDE_CONFIRMAR.test(m.texto) || CONFIRMADA.test(m.texto) || CANCELADA.test(m.texto)) e.add("confirmacion");
    } else if (m.tipo !== "boton" && !SOLO_CONFIRMA.test(m.texto) && m.texto !== "[reaction]") e.add("consulta");
  }
  return Array.from(e);
}

export function resumirDia(mensajes: MensajeResumen[], abiertas: ReadonlySet<string>, ahora: number, dia: string): Conteos {
  const porContacto = new Map<string, MensajeResumen[]>();
  for (const m of mensajes) { const l = porContacto.get(m.contact_hash); if (l) l.push(m); else porContacto.set(m.contact_hash, [m]); }
  const c: Conteos = { conversaciones: 0, persona: 0, confuso: 0, confirmacion: 0, consulta: 0, confirmacionesEnviadas: 0, confirmadas: 0, canceladas: 0 };
  for (const [hash, lista] of Array.from(porContacto)) {
    const hoy = lista.filter((m) => m.texto !== MARCA_CERRADO && ahoraChile(Date.parse(m.created_at)).fecha === dia);
    const e = etiquetasDe(lista, abiertas.has(hash), ahora, dia);
    if (e.includes("persona")) c.persona++;
    if (hoy.length === 0) continue;
    c.conversaciones++;
    if (e.includes("confuso")) c.confuso++;
    if (e.includes("confirmacion")) c.confirmacion++;
    if (e.includes("consulta")) c.consulta++;
    for (const m of hoy) {
      if (m.direccion !== "saliente") continue;
      if (PIDE_CONFIRMAR.test(m.texto)) c.confirmacionesEnviadas++;
      else if (CONFIRMADA.test(m.texto)) c.confirmadas++;
      else if (CANCELADA.test(m.texto)) c.canceladas++;
    }
  }
  return c;
}

export interface Salud { clientesNuevos: number; reservasAgente: number; mensajesFallidos: number; enviosFallidos: number; ultimoEntrante: string | null }

export function textoResumen(c: Conteos, s: Salud, guardando: boolean): string {
  const problemas = s.mensajesFallidos + s.enviosFallidos;
  const estado = problemas === 0 ? "✅ Sin fallas registradas hoy" : `⚠️ Hoy: ${s.mensajesFallidos} mensajes sin procesar y ${s.enviosFallidos} envíos fallidos`;
  const chats = guardando
    ? `💬 Conversaciones: ${c.conversaciones}\n• Esperan a una persona: ${c.persona}\n• No entendidas: ${c.confuso}\n• Dudas y consultas: ${c.consulta}\n• De confirmación: ${c.confirmacion}\n\n📅 Confirmaciones enviadas: ${c.confirmacionesEnviadas} · confirmadas: ${c.confirmadas} · canceladas: ${c.canceladas}`
    : "💬 El guardado de conversaciones está apagado: no puedo contarlas.";
  return `📊 Resumen de hoy\n\n${estado}\n\n🆕 Clientes nuevos: ${s.clientesNuevos}\n🤖 Reservas hechas por el agente: ${s.reservasAgente}\n\n${chats}${c.persona > 0 ? "\n\nEscribe *consultas* para ver las preguntas pendientes." : ""}`;
}
