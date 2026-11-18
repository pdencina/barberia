// Llamada a reservar al final de las respuestas informativas: "¿Quieres agendar? Reserva aquí: <link>".
// Solo usa el enlace general de reservas del negocio. No se agrega si la respuesta ya trae ese enlace, si habla de cancelar
// o si es el traspaso a una persona.
import { datoSeguro } from "./faq-fija";
import { AVISO_VOLVER } from "./menu";

export const TEXTO_CTA = "¿Quieres agendar? Reserva aquí:";

export const DEL_CURSO = /\b(curso|cursos|malla|temario|clases|alumnos?|certificad\w*|academia)\b/i;

export function conLlamadaAReservar(texto: string, linkReserva: string | null | undefined, consulta?: string): string {
  // Si se habla del curso, ofrecer "agendar una hora" no calza: se ofrece volver al menú.
  if (DEL_CURSO.test(texto) || (typeof consulta === "string" && DEL_CURSO.test(consulta))) {
    return /(^|[^a-záéíóúñ])men[uú]([^a-záéíóúñ]|$)/i.test(texto) ? texto : `${texto}\n\n${AVISO_VOLVER}`;
  }
  const link = typeof linkReserva === "string" ? linkReserva.trim() : "";
  if (!link || !/^https:\/\/\S+$/.test(link) || !datoSeguro(link)) return texto;
  if (texto.includes(link) || /cancel/i.test(texto) || /^te contactar[aá] una persona/i.test(texto.trim())) return texto;
  return `${texto}\n\n${TEXTO_CTA}\n${link}`;
}
