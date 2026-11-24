// Opción "Manicure" del menú: es otra línea de negocio (otra agenda y otra web), por eso va APARTE de la barbería:
// nada de esto pasa por la disponibilidad, las reservas por chat ni la IA de la barbería. Todo es determinista y solo entrega enlaces.
import { normalizar } from "./faq-fija";

export const LINK_MANICURE_RESERVA = "https://www.re-booking.cl/looky-estudio";
export const LINK_MANICURE_TRABAJOS = "https://estudiolevels.com/para-ellas";
export const TITULO_MANICURE = "Sobre manicure, elige lo que quieres ver:";
export const TITULO_MANICURE_SEGUIR = "¿Qué más quieres ver de manicure?";
const BOTON = "Ver opciones";

/** Filas de la lista (el título de WhatsApp admite 24 caracteres; el texto completo va en la descripción). */
export const FILAS_MANICURE = [
  { id: "k_reservar", title: "Reservar hora / Precios", description: "Reservar una hora y ver los precios" },
  { id: "k_trabajos", title: "Conocer los trabajos", description: "Quiero conocer los trabajos" },
  { id: "k_menu", title: "Volver al menú" },
] as const;

/** Textos canónicos que reemplazan al botón tocado (los entiende respuestaManicure). */
export const TEXTO_BOTON_MANICURE: Record<string, string> = { m5: "manicure", k_reservar: "manicure reservar hora y precios", k_trabajos: "manicure conocer los trabajos", k_menu: "menú" };

export function listaDeManicure(titulo: string = TITULO_MANICURE) { return { cuerpo: titulo, boton: BOTON, filas: FILAS_MANICURE }; }
/** Texto de respaldo si la lista no se puede enviar. */
export function textoManicure(): string { return `${TITULO_MANICURE}\n\nEscribe *reservar* (hora y precios) o *trabajos* (para conocer los trabajos). O escribe *menú* para volver al inicio.`; }
export function esTextoManicure(cuerpo: string): boolean { return cuerpo.startsWith(TITULO_MANICURE) && /\*trabajos\*/.test(cuerpo); }
export function esRespuestaManicure(cuerpo: string): boolean { return cuerpo.includes(LINK_MANICURE_RESERVA) || cuerpo.includes(LINK_MANICURE_TRABAJOS); }

const PALABRA_MANICURE = /\b(manicure|manicura|manicuria|pedicure|pedicura|esmalte|esmaltado|nail|nails|semipermanente|acrilica|acrilicas|acrilico|unas)\b/;
const PIDE_TRABAJOS = /\b(trabajos|trabajo|fotos|foto|portafolio|galeria|ejemplos|disenos|diseno|conocer)\b/;
const PIDE_RESERVAR = /\b(reservar|reserva|agendar|agenda|hora|horas|precio|precios|valor|valores|cuesta|cuanto|cuanto sale)\b/;

/**
 * Si el mensaje habla de manicure devuelve la respuesta (el submenú o el enlace pedido); si no, null.
 * "unas" solo cuenta cuando se escribió con ñ ("uñas"): "unas gracias" o "unas horas" no son manicure.
 */
export function respuestaManicure(texto: string): string | null {
  const bruto = texto.toLowerCase();
  const n = normalizar(texto).replace(/[!¡¿?.,]+/g, " ").replace(/\s+/g, " ").trim();
  if (!n) return null;
  const conUnas = /\bu[ñ]as\b/.test(bruto);
  if (!(PALABRA_MANICURE.test(n.replace(/\bunas\b/g, " ")) || conUnas)) return null;
  if (PIDE_TRABAJOS.test(n)) return `Aquí puedes conocer los trabajos de manicure:\n${LINK_MANICURE_TRABAJOS}`;
  if (PIDE_RESERVAR.test(n)) return `Para reservar tu hora de manicure y ver los precios entra aquí:\n${LINK_MANICURE_RESERVA}`;
  return textoManicure();
}
