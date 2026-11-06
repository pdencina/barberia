// Menú de opciones cuando el agente no entiende o el cliente solo saluda. Sin memoria: cada número se interpreta solo, y
// solo si no hay una reserva en curso (esa conversación se atiende antes).
import { normalizar, datoSeguro, responderFaq, type DatosFaq } from "./faq-fija";

export type OpcionMenu = 1 | 2 | 3 | 4;
// Mensajes largos que ninguna regla ni la IA entendió son una consulta real: los ve una persona, no se les muestra el menú.
export const PALABRAS_CONSULTA_LARGA = 6;

const SALUDO = /^(h?o+l+a+|holi+|buenas|buenos dias|buen dia|buenas tardes|buenas noches|hey|hello|que tal|saludos|buenas buenas)( .*)?$/;

export function esSaludo(texto: string): boolean {
  const n = normalizar(texto).replace(/[!¡.,]+/g, " ").replace(/\s+/g, " ").trim();
  return n.length > 0 && n.split(" ").length <= 4 && SALUDO.test(n);
}

/** "1", "2.", "opcion 3", "la 4": la opción elegida, o null. */
export function opcionMenu(texto: string): OpcionMenu | null {
  const m = /^(?:(?:opcion|la|el|numero|n)\s*)?([1-4])[\s.)!]*$/.exec(normalizar(texto).trim());
  return m ? (Number(m[1]) as OpcionMenu) : null;
}

// Saludo y nada más: reinicia la conversación. "hola quiero reservar" NO cuenta: trae una petición.
const PALABRAS_SALUDO = new Set(["hola", "holi", "holaa", "ola", "buenas", "buenos", "buen", "dia", "dias", "tardes", "noches", "hey", "hello", "saludos", "que", "tal", "como", "estas", "estan", "todos", "todo", "bien", "a"]);
export function esSoloSaludo(texto: string): boolean {
  const n = normalizar(texto).replace(/[!¡¿?.,]+/g, " ").replace(/\s+/g, " ").trim();
  if (!n) return false;
  const palabras = n.split(" ");
  return palabras.length <= 5 && /^(h?o+l+[ai]+|buenas|buenos|buen|hey|hello|saludos)/.test(palabras[0]) && palabras.every((w) => PALABRAS_SALUDO.has(w) || /^h?o+l+a+$/.test(w));
}

const VOLVER_EXACTO = new Set(["volver", "inicio", "salir", "atras", "reiniciar", "empezar de nuevo", "empezar otra vez", "de nuevo", "otra vez", "olvidalo", "no quiero", "ya no quiero", "cancelar", "menu"]);
/** "menú", "volver", "quiero abrir el menú", "empezar de nuevo": el cliente quiere salir del flujo y ver las opciones. */
export function esVolver(texto: string): boolean {
  const n = normalizar(texto).replace(/[!¡¿?.,]+/g, " ").replace(/\s+/g, " ").trim();
  if (!n) return false;
  const palabras = n.split(" ");
  if (VOLVER_EXACTO.has(n)) return true;
  if (palabras.length <= 6 && /\bmenu\b/.test(n)) return true;
  return palabras.length <= 5 && /^(quiero |puedo |podemos |necesito )?(volver|empezar|reiniciar|comenzar)\b/.test(n);
}

export const AVISO_VOLVER = "Escribe *menú* para volver al inicio.";

export function esConsultaLarga(texto: string): boolean {
  return normalizar(texto).split(/\s+/).filter(Boolean).length >= PALABRAS_CONSULTA_LARGA;
}

/** Lo que se busca con cada opción: pasa por las mismas reglas (disponibilidad, preguntas del negocio, IA) que cualquier mensaje. */
export const CONSULTA_POR_OPCION: Record<1 | 2 | 3, string> = {
  1: "tienen hora hoy",
  2: "informacion del curso de barberia",
  3: "precios horarios y ubicacion",
};

export const RESPUESTA_OTRAS = "Perfecto. Escribe tu consulta en un solo mensaje y una persona te contactará para responderla.";

export function textoMenu(datos: DatosFaq | null, tipo: "saludo" | "no_entendi" | "volver"): string {
  const nombre = datos?.negocio.nombre && datoSeguro(datos.negocio.nombre) ? datos.negocio.nombre.trim() : null;
  const tel = datos?.negocio.telefono && /^\+?[\d\s()-]{8,20}$/.test(datos.negocio.telefono.trim()) ? datos.negocio.telefono.trim() : null;
  const encabezado = tipo === "saludo"
    ? `¡Hola! ${nombre ? `Soy el asistente de ${nombre}. ` : ""}¿En qué te puedo ayudar? Elige una opción:`
    : tipo === "volver" ? "Volvamos al inicio. Elige una opción:" : "No entendí lo que me escribes. Por favor elige una de estas opciones:";
  return `${encabezado}\n\n1. Deseo reservar.\n2. Quiero información del curso.\n3. Quiero información de precios, horarios y ubicación.\n4. Otras preguntas.${tel ? `\n\nSi tienes dudas, llámanos al ${tel}, con gusto te atenderemos.` : ""}`;
}

/** Opción 3: horario, dirección y precios, cada uno con su regla de siempre. Solo lo que el negocio tiene cargado; null si no hay nada. */
export function infoGeneral(datos: DatosFaq | null): string | null {
  if (!datos) return null;
  const partes: string[] = [];
  for (const pregunta of ["a que hora abren", "donde quedan", "cuanto sale el corte"]) {
    const r = responderFaq(pregunta, datos);
    if (r.tipo === "respuesta" && !partes.includes(r.texto)) partes.push(r.texto);
  }
  return partes.length ? partes.join("\n\n") : null;
}

// Menú como lista de WhatsApp (botón "Ver opciones"): cada fila responde con su número, que el flujo ya entiende como opción.
const FILAS_MENU = [
  { id: "1", title: "Reservar una hora" },
  { id: "2", title: "Información del curso" },
  { id: "3", title: "Precios y horarios", description: "Precios, horarios y ubicación" },
  { id: "4", title: "Otras preguntas" },
] as const;
export const BOTON_MENU = "Ver opciones";
export function esTextoMenu(cuerpo: string): boolean { return /\n1\. Deseo reservar\.\n2\./.test(cuerpo); }
export function listaDeMenu(cuerpo: string): { cuerpo: string; boton: string; filas: readonly { id: string; title: string; description?: string }[] } {
  const sinNumeros = cuerpo.replace(/\n*1\. Deseo reservar\.\n2\. [^\n]*\n3\. [^\n]*\n4\. [^\n]*\n*/, "\n\n").replace(/\n{3,}/g, "\n\n").trim();
  return { cuerpo: sinNumeros.replace(/Elige una opción:|elige una de estas opciones:/i, (m) => m.replace(/:$/, " en el botón:")), boton: BOTON_MENU, filas: FILAS_MENU };
}
