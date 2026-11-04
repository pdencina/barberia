// Respuestas deterministas que complementan la FAQ fija: preguntas propias del negocio, link por profesional,
// horario por día, servicios por nombre y ubicación. Sin red, base, reloj ni modelo; nunca repite el texto del cliente.
import type { DatosFaq } from "./faq-fija";

export const MAX_PERSONALIZADAS_POR_MENSAJE = 3;
export const MAX_LARGO_RESPUESTA = 700;
const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const norm = (s: string) => s.normalize("NFC").toLowerCase().normalize("NFD").replace(/([aeiou])[\u0300-\u036f]+/g, "$1").normalize("NFC").trim().replace(/\s+/g, " ");
const sinSignos = (s: string) => norm(s).replace(/[¿?¡!.,;:()"]/g, " ").replace(/\s+/g, " ").trim();
const FORMATO = /[\u0000-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/;

export interface PreguntaPropia { id: string; claves: string[]; respuesta: string }
/** ¿Se puede usar esta pregunta propia? Respuesta de texto simple y con al menos una clave válida. */
export function preguntaPropiaValida(p: unknown): p is PreguntaPropia {
  const x = p as PreguntaPropia;
  return !!x && typeof x.id === "string" && typeof x.respuesta === "string" && x.respuesta.trim().length > 0 && x.respuesta.length <= MAX_LARGO_RESPUESTA && !FORMATO.test(x.respuesta.replace(/\n/g, ""))
    && Array.isArray(x.claves) && x.claves.some((c) => typeof c === "string" && sinSignos(c).length >= 3);
}

/** Preguntas propias que coinciden con el mensaje: gana quien tiene la clave más larga; hasta 3 distintas se responden juntas. */
export function responderPersonalizadas(textoNormalizado: string, lista: DatosFaq["personalizadas"]): string | null {
  if (!Array.isArray(lista) || lista.length === 0) return null;
  const t = " " + sinSignos(textoNormalizado) + " ";
  const aciertos: { largo: number; r: string }[] = [];
  for (const p of lista) {
    if (!preguntaPropiaValida(p)) continue;
    let mejor = 0;
    for (const c of p.claves) {
      const k = sinSignos(String(c));
      if (k.length < 3) continue;
      // Coincidencia por palabra completa o inicio de palabra para claves de 5 letras o más ("estacionamiento" acepta "estacionamientos").
      const re = new RegExp(`(^|\\s)${escapar(k)}${k.length >= 5 ? "[a-zñ]{0,2}" : ""}(?=\\s)`);
      if (re.test(t)) mejor = Math.max(mejor, k.length);
    }
    if (mejor > 0) aciertos.push({ largo: mejor, r: p.respuesta.trim() });
  }
  if (aciertos.length === 0) return null;
  aciertos.sort((a, b) => b.largo - a.largo);
  const textos: string[] = [];
  for (const a of aciertos) if (!textos.includes(a.r)) textos.push(a.r);
  return textos.slice(0, MAX_PERSONALIZADAS_POR_MENSAJE).join("\n\n");
}

const NOMBRE_DIA: Record<string, number> = { domingo: 0, lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6 };
const PLURAL_DIA = ["los domingos", "los lunes", "los martes", "los miércoles", "los jueves", "los viernes", "los sábados"];
const URL_OK = (v: unknown): v is string => { try { if (typeof v !== "string") return false; const u = new URL(v.trim()); return ["https:", "http:"].includes(u.protocol) && !u.username && !u.password; } catch { return false; } };
const PARADA = new Set(["de", "del", "la", "el", "los", "las", "con", "para", "y", "en", "un", "una", "por", "a", "al", "que", "tipo", "servicio", "servicios"]);
const tokens = (s: string) => sinSignos(s).replace(/\+/g, " ").split(" ").filter((w) => w && !PARADA.has(w));

type Extra = { intencion: "agendar" | "horario" | "precio_servicio" | "servicios" | "direccion"; texto: string } | null;
/** Reglas con los datos que ya tiene el negocio. null = no aplica o es ambiguo (se deriva como siempre). */
export function responderExtra(textoNormalizado: string, datos: DatosFaq | null): Extra {
  if (!datos) return null;
  // Emojis y símbolos raros: los ve una persona.
  if (/[^a-zñ0-9\s¿?¡!.,;:()+'"\-]/.test(textoNormalizado)) return null;
  // Mensajes con enlaces o dominios no se responden con reglas sueltas: los ve una persona.
  if (/https?:|www\.|[a-z0-9]\.[a-z]{2,}|_|\d{4,}/.test(textoNormalizado)) return null; // también códigos o marcadores raros
  const t = sinSignos(textoNormalizado);
  const palabras = t.split(" ");
  const reglas: Array<() => Extra> = [
    () => {
  // 1) Link de un profesional o de la agenda general.
  if (/\b(link|enlace|url)\b/.test(t)) {
    const lista = (Array.isArray(datos.profesionales) ? datos.profesionales : []).filter((p) => p && typeof p.nombre === "string" && URL_OK(p.link));
    const quienes = lista.filter((p) => norm(p.nombre).split(" ").filter((x) => x.length >= 3).some((tok) => palabras.some((w) => w === tok || (w.length >= 4 && tok.startsWith(w)))));
    if (quienes.length === 1) return { intencion: "agendar", texto: `Aquí puedes agendar con ${quienes[0].nombre.trim()}: ${quienes[0].link.trim()}` };
    if (quienes.length === 0 && URL_OK(datos.negocio.linkReserva) && /\b(todos|todas|general|agenda|reserva|reservar|agendar|barberos|profesionales|equipo)\b/.test(t))
      return { intencion: "agendar", texto: `Aquí ves la agenda de todos los profesionales y eliges: ${datos.negocio.linkReserva!.trim()}` };
  }

      return null;
    },
    () => {
  // 2) Horario de un día ("¿atienden los domingos?", "¿hasta qué hora los sábados?").
  const dias = Array.from(new Set(palabras.map((w) => w.replace(/s$/, "")).filter((w) => w in NOMBRE_DIA).map((w) => NOMBRE_DIA[w])));
  if (dias.length > 0 && dias.length <= 2 && /\b(atienden|atiende|atencion|abren|abre|abierto|abiertos|cierran|cierra|horario|funcionan|trabajan|hora|disponibilidad|disponible|disponibles)\b/.test(t) && !/\b(bastian|barbero|profesional)\b/.test(t) && Array.isArray(datos.horario)) {
    const frases: string[] = [];
    for (const d of dias) {
      const fila = datos.horario.find((r) => r && r.dia === d);
      if (!fila || typeof fila.cerrado !== "boolean") return null;
      if (fila.cerrado) frases.push(`${PLURAL_DIA[d][0].toUpperCase()}${PLURAL_DIA[d].slice(1)} no atendemos.`);
      else if (/^\d\d:\d\d$/.test(String(fila.abre)) && /^\d\d:\d\d$/.test(String(fila.cierra))) frases.push(`${PLURAL_DIA[d][0].toUpperCase()}${PLURAL_DIA[d].slice(1)} atendemos de ${fila.abre} a ${fila.cierra}.`);
      else return null;
    }
    return { intencion: "horario", texto: frases.join(" ") };
  }

      return null;
    },
    () => {
  // 3) Un servicio por nombre ("¿hacen perfilado de cejas?", "¿cuánto sale el corte + barba con toallas calientes?").
  const servicios = (Array.isArray(datos.servicios) ? datos.servicios : []).filter((s) => s && typeof s.nombre === "string" && s.nombre.trim());
  if (servicios.length > 0 && !/\b(dura|duran|duracion|demora|demoran|tiempo|minutos|horas|dolar|dolares|usd|euro|euros|uf|clp|descuento|promocion|oferta)\b/.test(t) && /\b(hacen|hace|realizan|ofrecen|tienen|cuanto|precio|valor|sale|cuesta|cobran|vale)\b/.test(t)) {
    const msg = new Set(tokens(t));
    const aciertos = servicios.map((s) => ({ s, tk: tokens(s.nombre) })).filter((x) => x.tk.length > 0 && x.tk.every((w) => msg.has(w) || Array.from(msg).some((m) => m.length >= 4 && w.startsWith(m))))
      .sort((a, b) => b.tk.length - a.tk.length);
    if (aciertos.length > 0 && (aciertos.length === 1 || aciertos[0].tk.length > aciertos[1].tk.length)) {
      const s = aciertos[0].s;
      // Si otro servicio contiene todas las palabras de este ("Corte" y "Corte premium"), el nombre es ambiguo: lo resuelve la FAQ fija o una persona.
      const tk0 = aciertos[0].tk;
      if (servicios.some((o) => o !== s && tk0.every((w) => tokens(o.nombre).includes(w)))) return null;
      const pregunta = /\b(cuanto|precio|valor|sale|cuesta|cobran|vale)\b/.test(t);
      const precio = typeof s.precio === "number" && Number.isFinite(s.precio) && s.precio >= 0 ? `$${new Intl.NumberFormat("es-CL").format(s.precio)}` : null;
      if (pregunta && precio) return { intencion: "precio_servicio", texto: `Precio base de ${s.nombre.trim()}: ${precio}. Los profesionales pueden tener precios distintos.` };
      if (!pregunta) return { intencion: "servicios", texto: `Sí, tenemos ${s.nombre.trim()}${precio ? `: ${precio}` : ""}. Si quieres, te ayudo a agendar.` };
    }
  }

      return null;
    },
    () => {
  // 4) Ubicación ("¿dónde están ubicados?", "¿dónde están en Puente Alto?").
  if (/\b(donde)\b.*\b(estan|queda|quedan|ubicad[oa]s?|encuentran|llego)\b|\bubicad[oa]s?\b/.test(t) && typeof datos.negocio.direccion === "string" && datos.negocio.direccion.trim())
    return { intencion: "direccion", texto: `Dirección: ${datos.negocio.direccion.trim()}.` };
      return null;
    },
  ];
  // Si el mensaje toca más de un tema ("dirección y precios") no se responde a medias: lo ve una persona.
  const resultados = reglas.map((f) => f()).filter((x): x is NonNullable<Extra> => x !== null);
  return resultados.length === 1 ? resultados[0] : null;
}
