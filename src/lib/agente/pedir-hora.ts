// "Quiero reservar una hora": en vez de mandar solo el enlace, el agente pregunta con quién y ayuda a reservar por el chat.
import type { DatosFaq } from "./faq-fija";
import { normalizar } from "./faq-fija";

const limpio = (t: string) => normalizar(t).replace(/[!¡¿?.,;:]+/g, " ").replace(/\s+/g, " ").trim();
const SALUDO = /^(?:(?:holaa+|hola|holi|buenos dias|buenas tardes|buenas noches|buen dia|buenas|saludos|que tal|como estas?) )+/;
const GENERAL = /^(?:(?:quiero|quisiera|necesito|deseo|me gustaria|queria|puedo|podria|como puedo|como) )?(?:(?:agendar|reservar|agendarme|agendo|reservo|pedir|sacar|tomar)(?: (?:una|un|mi))?(?: (?:hora|cita|turno|reserva))?|(?:una|un) (?:hora|cita|turno|reserva))(?: (?:por favor|porfa|porfavor|plis))?$/;
const CUALQUIERA = /^(?:(?:con )?(?:el |la )?(?:primer[oa]?|quien) (?:que )?(?:este |esta |tenga )?(?:disponible|libre|hora)|(?:con )?(?:el |la )?primer[oa]|(?:con )?cualquiera|(?:me )?da (?:lo mismo|igual)|sin preferencia|no tengo preferencia|(?:con )?el que sea)(?: (?:profesional|barbero|por favor|porfa))?$/;

export function esPedidoGeneral(texto: string): boolean {
  return GENERAL.test(limpio(texto).replace(SALUDO, ""));
}

export function preguntaPreferencia(datos: DatosFaq | null): string | null {
  const nombres = (datos?.profesionales ?? []).map((p) => p.nombre?.trim()).filter(Boolean) as string[];
  if (nombres.length < 2) return null;
  const link = datos?.negocio.linkReserva?.trim();
  return `¡Claro, te ayudo a reservar! ¿Tienes preferencia de profesional?\n\n${nombres.slice(0, 12).map((n) => `• ${n}`).join("\n")}\n\nEscríbeme el nombre, o *primero disponible* y te muestro las horas más próximas.${link ? `\n\nSi prefieres hacerlo tú: ${link}` : ""}`;
}

/** La respuesta a esa pregunta (un nombre solo, o "primero disponible") convertida en una consulta de horas. null = no es eso. */
export function consultaDePreferencia(texto: string, datos: DatosFaq | null): string | null {
  const t = limpio(texto).replace(SALUDO, "");
  if (CUALQUIERA.test(t)) return "tienen horas disponibles";
  const nombre = t.replace(/^(?:con|prefiero(?: con| a)?) /, "").replace(/ (?:por favor|porfa)$/, "");
  const hallados = (datos?.profesionales ?? []).filter((p) => { const n = limpio(p.nombre ?? ""); return !!n && (n === nombre || n.split(" ")[0] === nombre); });
  return hallados.length === 1 ? `${hallados[0].nombre} tiene hora disponible` : null;
}
