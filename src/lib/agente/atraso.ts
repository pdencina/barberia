// "Voy atrasado": respuesta fija con la regla del negocio, sin IA.
// La regla la define cada negocio en sus respuestas: una respuesta propia con alguna de estas claves
// (el modelo "Atrasos" de la pantalla de preguntas ya las trae).
// Sin esa respuesta, el mensaje sigue el camino de siempre.
import type { DatosFaq } from "./faq-fija";
import { normalizar } from "./faq-fija";

export const CLAVES_ATRASO = new Set(["aviso de atraso", "atraso", "atrasado", "llego tarde"]);
const ADV = "(?:(?:algo|un poco|un poquito|poquito|super|muy|bastante|\\d{1,2} ?(?:min|mins|minutos)) )*";
const AVISA = new RegExp([
  `\\b(?:voy|estoy|ando|vengo) ${ADV}(?:atrasad[oa]|tarde|retrasad[oa]|con (?:atraso|retraso))\\b`,
  `\\b(?:llego|llegare|voy a llegar|llegaria|llegamos) ${ADV}(?:tarde|atrasad[oa]|con (?:atraso|retraso))\\b`,
  `\\b(?:me atrase|me retrase|se me hizo tarde|voy (?:algo )?justo con la hora)\\b`,
  `\\b(?:llego|llegare|voy a llegar) (?:en )?(?:como )?(?:\\d{1,2}|unos|cinco|diez|quince) ?(?:min|mins|minutos)? (?:tarde|atrasad[oa]|mas tarde)\\b`,
].join("|"));
/** Solo la causa ("el Uber se demoró"): se contesta corto. */
const CAUSA = /\b(uber|didi|cabify|taxi|micro|bus|metro)\b.{0,25}\b(demor\w*|atras\w*)\b|\b(demor\w*|atras\w*)\b.{0,15}\b(uber|didi|cabify|taxi|micro|bus|metro)\b|\bhay (?:mucho |harto )?(?:taco|trafico)\b/;
/** Hablan de buscar o cambiar una hora, no de la de ahora. */
const OTRA_COSA = /\b(salgo|trabajo|pega|agendar|reservar|disponible|disponibilidad|ma[nñ]ana|semana|cancelar)\b/;

export function respuestaDeAtraso(texto: string, datos: DatosFaq | null): string | null {
  const propia = datos?.personalizadas?.find?.((p) => p && typeof p.respuesta === "string" && Array.isArray(p.claves) && p.claves.some((c) => CLAVES_ATRASO.has(normalizar(String(c)))));
  if (!propia || typeof texto !== "string" || texto.length > 200) return null;
  const t = normalizar(texto).replace(/[!¡¿?.,;:]+/g, " ").replace(/\s+/g, " ").trim();
  if (OTRA_COSA.test(t)) return null;
  if (AVISA.test(t)) return propia.respuesta.trim();
  // La frase del negocio que dice los minutos sirve de recordatorio corto.
  return CAUSA.test(t) ? `Entendido, gracias por avisar. ${propia.respuesta.split(/(?<=\.)\s+|\n+/).find((f) => /minutos/i.test(f)) ?? ""}`.trim() : null;
}
