// "¿Quedó agendada mi hora?" / "no me llegó el correo": se pide el correo o el código de reserva y se revisa en la agenda real.
import { textoDeFecha } from "./disponibilidad";
import { normalizar } from "./faq-fija";

export type Identificador = { correo: string } | { codigo: string } | { telefono: string };
export interface CitaEncontrada { nombre: string; codigo: string | null; citas: { profesional: string; fecha: string; hora: string; servicio: string }[] }
export type BuscarCitas = (id: Identificador) => Promise<CitaEncontrada | null>;

const CITA = "(?:mi |la |una )?(?:hora|cita|reserva)";
const PREGUNTAS = [
  /\bse (?:me )?(?:agendo|reservo|confirmo|guardo)\b/,
  /\bqued(?:o|e|a) (?:bien )?(?:agendad|reservad|confirmad|registrad|tomad)/,
  new RegExp(`\\b${CITA}\\b.{0,60}\\b(?:agendada|reservada|confirmada|registrada)\\b`),
  new RegExp(`\\b(?:revisar|revisame|verificar|verificame|comprobar|consultar|confirmame) (?:si )?.{0,20}\\b${CITA}\\b`),
  /\bsaber (?:si|a que hora|cuando|con quien)\b.{0,60}\b(?:hora|cita|reserva|agend)/,
  /\bya (?:agende|reserve)\b/,
  /\bno (?:me )?(?:ha )?(?:llego|llegado|llega)\b.{0,50}\b(?:correo|mail|email|confirmacion|mensaje|whatsapp|codigo)\b/,
  /\b(?:correo|mail|email|confirmacion|codigo)\b.{0,40}\bno (?:me )?(?:ha )?(?:llego|llegado|llega)\b/,
  /\b(?:cual|cuando|a que hora) (?:es|era|tengo) (?:mi )?(?:hora|cita|reserva)\b/,
  /\b(?:olvide|perdi|no se|no recuerdo) (?:mi |el )?codigo\b/,
];
const CORREO = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
const PIDE_OTRO = "Si la reservaste con otro número o es para otra persona, envíame el *correo* con el que se reservó o el *código de reserva* (5 letras o números, sale en el correo de confirmación).";
const PIDE = "Claro, te ayudo a revisarlo. Envíame el *correo* con el que reservaste o tu *código de reserva* (5 letras o números, sale en el correo de confirmación).";

export const preguntaPorSuCita = (texto: string) => { const t = normalizar(texto); return PREGUNTAS.some((r) => r.test(t)); };

/** El correo o código que vino en el mensaje. Un código suelto es el mensaje completo ("UJ6N4") o va después de la palabra "código". */
export function identificador(texto: string): Identificador | null {
  const correo = CORREO.exec(texto)?.[0];
  if (correo) return { correo: correo.toLowerCase() };
  const solo = /^\s*([A-HJ-NP-Za-hj-np-z2-9]{5})\s*$/.exec(texto)?.[1] ?? /\bc[oó]digo(?: de reserva)?(?: es)?\s*:?\s*([A-HJ-NP-Z2-9]{5})\b/i.exec(texto)?.[1];
  return solo ? { codigo: solo.toUpperCase() } : null;
}

/** null = no es una consulta sobre su hora (sigue el flujo de siempre). */
export async function responderMiCita(texto: string, hoy: string, buscar: BuscarCitas, telefono?: string): Promise<{ texto: string; sinResultado?: boolean } | null> {
  const pregunta = preguntaPorSuCita(texto);
  const id = identificador(texto);
  const sueltos = !!id && ("correo" in id ? texto.trim().toLowerCase() === id.correo : true);
  if (!pregunta && !sueltos) return null;
  if (!id) {
    // Primero, las horas del mismo número que escribe (WhatsApp ya lo identifica). Si no hay (reservó con otro número, o para otra persona), se pide correo o código.
    const propia = telefono ? await buscar({ telefono }) : null;
    if (propia && propia.citas.length > 0) return { texto: `${redactar(propia, hoy)}\n\n¿Preguntas por la hora de otra persona? Envíame el *correo* con que se reservó o su *código de reserva*.` };
    return { texto: telefono ? `No veo una hora próxima con tu número. ${PIDE_OTRO}` : PIDE };
  }
  const r = await buscar(id);
  // Cinco letras sueltas que no son el código de nadie ("dylan") no se toman como código.
  if (!r && "codigo" in id && !pregunta && !/\d/.test(id.codigo)) return null;
  const dato = "correo" in id ? "ese correo" : "ese código";
  if (!r || r.citas.length === 0) return { texto: `No encuentro una hora próxima con ${dato}. Revisa que esté bien escrito, o envíame ${"correo" in id ? "tu *código de reserva*" : "el *correo* con el que reservaste"}. Le aviso al equipo para que lo revise.`, sinResultado: true };
  return { texto: redactar(r, hoy) };
}

function redactar(r: CitaEncontrada, hoy: string): string {
  const lista = r.citas.slice(0, 3).map((c) => `• *${c.profesional}*, ${textoDeFecha(c.fecha, hoy)} a las *${c.hora}*${c.servicio ? ` (${c.servicio})` : ""}`).join("\n");
  const nombre = r.nombre.trim().split(/\s+/)[0] ?? "";
  const codigo = r.codigo ? `\n\n*Tu código de reserva es: ${r.codigo.toUpperCase()}*` : "";
  return `Sí${nombre ? `, ${nombre}` : ""}: ${r.citas.length === 1 ? "tu hora está agendada" : "estas son tus horas agendadas"}:\n\n${lista}${codigo}\n\nRecomendamos llegar unos minutos antes. Si no te llegó el correo, revisa tu carpeta de spam; la reserva vale igual.`;
}
