// Menú de opciones cuando el agente no entiende o el cliente solo saluda. Sin memoria: cada número se interpreta solo, y
// solo si no hay una reserva en curso (esa conversación se atiende antes).
import { normalizar, datoSeguro, responderFaq, type DatosFaq } from "./faq-fija";

export type OpcionMenu = 1 | 2 | 3 | 4;
// Mensajes largos que ninguna regla ni la IA entendió son una consulta real: los ve una persona, no se les muestra el menú.
export const PALABRAS_CONSULTA_LARGA = 6;

const SALUDO = /^(hola+|holi+|ola|buenas|buenos dias|buen dia|buenas tardes|buenas noches|hey|hello|que tal|saludos|buenas buenas)( .*)?$/;

export function esSaludo(texto: string): boolean {
  const n = normalizar(texto).replace(/[!¡.,]+/g, " ").replace(/\s+/g, " ").trim();
  return n.length > 0 && n.split(" ").length <= 4 && SALUDO.test(n);
}

/** "1", "2.", "opcion 3", "la 4": la opción elegida, o null. */
export function opcionMenu(texto: string): OpcionMenu | null {
  const m = /^(?:(?:opcion|la|el|numero|n)\s*)?([1-4])[\s.)!]*$/.exec(normalizar(texto).trim());
  return m ? (Number(m[1]) as OpcionMenu) : null;
}

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

export function textoMenu(datos: DatosFaq | null, tipo: "saludo" | "no_entendi"): string {
  const nombre = datos?.negocio.nombre && datoSeguro(datos.negocio.nombre) ? datos.negocio.nombre.trim() : null;
  const tel = datos?.negocio.telefono && /^\+?[\d\s()-]{8,20}$/.test(datos.negocio.telefono.trim()) ? datos.negocio.telefono.trim() : null;
  const encabezado = tipo === "saludo"
    ? `¡Hola! ${nombre ? `Soy el asistente de ${nombre}. ` : ""}¿En qué te puedo ayudar? Elige una opción:`
    : "No entendí lo que me escribes. Por favor elige una de estas opciones:";
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
