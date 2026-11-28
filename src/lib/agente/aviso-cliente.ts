// El cliente CUENTA algo ("ya reagendé para más tarde", "ya cancelé", "voy en camino"): se le agradece y se le confirma,
// en vez de leerlo como una consulta de horas. Sin IA. Si trae una pregunta, sigue el camino de siempre.
import { normalizar } from "./faq-fija";
import { textoDeFecha } from "./disponibilidad";
import { horaAmPm } from "../hora-ampm";
import type { BuscarCitas } from "./mi-cita";

export type TipoAviso = "agendo" | "cancelo" | "camino" | "puerta";
// Está en el local y no le abren: es urgente, aunque venga como pregunta.
const PUERTA = /\b(no sale nadie|nadie sale|no me (?:abren|abre nadie)|nadie (?:me )?(?:abre|atiende la puerta|contesta (?:la puerta|el timbre))|no abren la puerta)\b/;
const PREGUNTA = /\b(saber|quisiera|queria|quiero|puedo|pueden|podria|necesito|como|cuando|donde|cual|que hora|correo|mail|codigo|confirmacion|no me|no se|no pude|no puedo|tienen|tiene|hay)\b/;
// Sin «ya» ni tilde, «reagende mi hora» o «cancele mi cita» son un pedido, no un aviso.
const AGENDO = /\bya (?:re ?agende|agende|reserve|cambie (?:mi |la )?(?:hora|cita)|tome (?:otra|una) hora|pedi (?:otra|una) hora)\b/;
const CANCELO = /\bya (?:cancele|anule)\b/;
const AGENDO_TILDE = /(?:^|\s)(?:re ?agendé|cambié (?:mi |la )(?:hora|cita))(?=\s|$|[.,!])/i;
const CANCELO_TILDE = /(?:^|\s)(?:cancelé|anulé) (?:mi|la) (?:hora|cita|reserva)/i;
const PEDIDO = /\b(por favor|porfa|porfavor|plis)\b/;
const PAGO = /\b(abono|pago|pague|transfer\w*|luca\w*|plata|deposit\w*|monto|valor)\b/; // «cancelé» también es «pagué»
const CAMINO = /\b(?:voy (?:en camino|saliendo|llegando|para alla)|estoy (?:afuera|llegando|en camino|abajo)|ya llegue|ando afuera)\b/;

export function tipoDeAviso(texto: string): TipoAviso | null {
  if (typeof texto !== "string" || texto.length > 160) return null;
  const t = normalizar(texto).replace(/[!¡¿?.,;:]+/g, " ").replace(/\s+/g, " ").trim();
  if (PUERTA.test(t)) return "puerta";
  if (/[?¿]/.test(texto)) return null;
  if (PREGUNTA.test(t) || PEDIDO.test(t)) return null;
  if (AGENDO.test(t) || AGENDO_TILDE.test(texto)) return "agendo";
  if (CANCELO.test(t) || CANCELO_TILDE.test(texto)) return PAGO.test(t) ? null : "cancelo";
  return CAMINO.test(t) ? "camino" : null;
}

export async function responderAviso(texto: string, hoy: string, telefono: string, buscar?: BuscarCitas): Promise<string | null> {
  const tipo = tipoDeAviso(texto);
  if (!tipo) return null;
  if (tipo === "puerta") return "¡Disculpa la espera! 🙏 Le estoy avisando al equipo ahora para que te abran.";
  if (tipo === "camino") return "¡Gracias por avisar! 🙌 Te esperamos.";
  let citas: { profesional: string; fecha: string; hora: string }[] | null = null;
  if (buscar) { try { citas = (await buscar({ telefono }))?.citas ?? []; } catch { citas = null; } }
  const lista = (citas ?? []).slice(0, 3).map((c) => `• *${c.profesional}*, ${textoDeFecha(c.fecha, hoy)} a las *${horaAmPm(c.hora)}*`).join("\n");
  if (tipo === "agendo") {
    if (lista) return `¡Perfecto, gracias por avisar! 🙌 Así quedó tu agenda:\n\n${lista}\n\n¡Te esperamos!`;
    return citas ? "¡Perfecto, gracias por avisar! 🙌 No veo la hora con este número; si quieres que la revise, envíame tu *código de reserva*." : "¡Perfecto, gracias por avisar! 🙌 ¡Te esperamos!";
  }
  return lista ? `Gracias por avisarnos 🙌 Todavía veo agendado:\n\n${lista}\n\nSi es la que querías cancelar, dímelo y lo revisa el equipo.` : "Gracias por avisarnos 🙌 Cuando quieras volver, escríbeme y te ayudo a reservar.";
}
