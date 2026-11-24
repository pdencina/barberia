// Menú de opciones cuando el agente no entiende o el cliente solo saluda. Sin memoria: cada número se interpreta solo, y
// solo si no hay una reserva en curso (esa conversación se atiende antes).
import { normalizar, datoSeguro, responderFaq, type DatosFaq } from "./faq-fija";

export type OpcionMenu = 1 | 2 | 3 | 4;
// Mensajes largos que ninguna regla ni la IA entendió son una consulta real: los ve una persona, no se les muestra el menú.
export const PALABRAS_CONSULTA_LARGA = 6;

const SALUDO = /^(h?o+l+a+s?|holi+|wena+s?|weno+s?|hi|buenas|buenos dias|buen dia|buenas tardes|buenas noches|hey|hello|que tal|saludos|buenas buenas)( .*)?$/;

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
const PALABRAS_SALUDO = new Set(["po", "poh", "pos", "amigo", "amigos", "hermano", "bro", "broder", "compadre", "compa", "socio", "cabros", "gente", "ahi", "oye", "cachai", "hola", "holi", "holaa", "ola", "buenas", "buenos", "buen", "dia", "dias", "tardes", "noches", "hey", "hello", "saludos", "que", "tal", "como", "estas", "estan", "todos", "todo", "bien", "a"]);
export function esSoloSaludo(texto: string): boolean {
  const n = normalizar(texto).replace(/[!¡¿?.,]+/g, " ").replace(/\s+/g, " ").trim();
  if (!n) return false;
  const palabras = n.split(" ");
  return palabras.length <= 5 && /^(h?o+l+[ai]+s?|wena+s?|weno+s?|hi|buenas|buenos|buen|hey|hello|saludos)/.test(palabras[0]) && palabras.every((w) => PALABRAS_SALUDO.has(w) || /^h?o+l+a+s?$/.test(w) || /^wena+s?$/.test(w));
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
  { id: "m1", title: "Reservar una hora" },
  { id: "m2", title: "Información del curso" },
  { id: "m3", title: "Precios y horarios", description: "Precios, horarios y ubicación" },
  { id: "m4", title: "Otras preguntas" },
] as const;
export const BOTON_MENU = "Ver opciones";
export function esTextoMenu(cuerpo: string): boolean { return /\n1\. Deseo reservar\.\n2\./.test(cuerpo); }
export function listaDeMenu(cuerpo: string): { cuerpo: string; boton: string; filas: readonly { id: string; title: string; description?: string }[] } {
  const sinNumeros = cuerpo.replace(/\n*1\. Deseo reservar\.\n2\. [^\n]*\n3\. [^\n]*\n4\. [^\n]*\n*/, "\n\n").replace(/\n{3,}/g, "\n\n").trim();
  return { cuerpo: sinNumeros.replace(/Elige una opción:|elige una de estas opciones:/i, (m) => m.replace(/:$/, " en el botón:")), boton: BOTON_MENU, filas: FILAS_MENU };
}

// ---- Submenú del curso (lista de WhatsApp). Cada fila vuelve como un id "c_..." que se traduce a una consulta concreta.
const BOTON_FILAS_CURSO = [
  { id: "c_malla", title: "Malla del curso" },
  { id: "c_valor", title: "Valor y cómo reservar" },
  { id: "c_fechas", title: "Fechas y horarios" },
  { id: "c_video", title: "Video explicativo" },
  { id: "c_otras", title: "Otras preguntas" },
  { id: "c_menu", title: "Volver al menú" },
] as const;
export const TITULO_CURSO = "Sobre el curso de barbería, elige lo que quieres ver:";
export const TITULO_CURSO_SEGUIR = "¿Qué más quieres ver del curso?";
/** Texto de respaldo si la lista no se puede enviar (sin botones). */
export function textoCurso(): string { return `${TITULO_CURSO}\n\nEscribe lo que quieres ver: *malla*, *valor*, *fechas* o *video*. O escribe *menú* para volver al inicio.`; }
export function esTextoCurso(cuerpo: string): boolean { return cuerpo.startsWith(TITULO_CURSO) && /\*malla\*/.test(cuerpo); }
export function listaDeCurso(titulo: string = TITULO_CURSO) { return { cuerpo: titulo, boton: BOTON_MENU, filas: BOTON_FILAS_CURSO }; }

const CONSULTA_BOTON: Record<string, string> = {
  m1: "1", m2: "2", m3: "3", m4: "4",
  r1: "1", r2: "2", r3: "3", r4: "4", r5: "5", r6: "6", r7: "7", r8: "8", // opciones de la reserva por chat (profesional o servicio)
  c_malla: "quiero la malla del curso de barbería", c_valor: "cuánto cuesta el curso de barbería y cómo reservo mi cupo",
  c_fechas: "cuándo comienza el curso de barbería y en qué horario son las clases", c_video: "quiero el video explicativo del curso de barbería",
  c_otras: "4", c_menu: "menú",
};
/** Un botón o fila de lista llega como su id: aquí se traduce al texto que el flujo ya entiende. null = no es uno de nuestros botones. */
export function textoDeBoton(tipo: string, id: unknown): string | null {
  return tipo === "interactive" && typeof id === "string" && Object.prototype.hasOwnProperty.call(CONSULTA_BOTON, id) ? CONSULTA_BOTON[id] : null;
}
const PIDE_INFO_CURSO = /\b(info|informacion|saber|conocer|detalles?|del curso|sobre el curso|el curso)\b/;
/** "información del curso", "quiero saber del curso", "del curso": pide el curso en general (sin una pregunta concreta). */
export function pideInfoCursoGeneral(texto: string): boolean {
  const n = normalizar(texto).replace(/[!¡¿?.,]+/g, " ").replace(/\s+/g, " ").trim();
  const w = n.split(" ").filter(Boolean);
  return w.length >= 2 && w.length <= 7 && /\bcurso\b/.test(n) && PIDE_INFO_CURSO.test(n) && !/\b(precio|cuesta|cuanto|valor|malla|temario|video|fecha|cuando|horario|donde|cupo|abono|certificad\w*|edad|requisito\w*)\b/.test(n);
}

/** Piloto con número aparte: cuando una persona debe intervenir, el cliente va al número real del negocio (donde sí hay quien responda).
 *  null = el negocio no tiene un teléfono válido: se usa el texto de siempre. */
export function textoDerivacionTelefono(datos: DatosFaq | null, intro: string): string | null {
  const tel = datos?.negocio.telefono?.trim() ?? "";
  if (!/^\+?[\d\s()-]{8,20}$/.test(tel)) return null;
  const digitos = tel.replace(/\D/g, "");
  if (digitos.length < 8 || digitos.length > 15) return null;
  return `${intro}\n\nEscríbenos por WhatsApp al ${tel} y te ayudamos:\nhttps://wa.me/${digitos}`;
}

// ---- Intenciones que no pasan por la IA: pedir a una persona, cambiar o cancelar una hora, y mensajes que no son texto.
const norm = (t: string) => normalizar(t).replace(/[!¡¿?.,]+/g, " ").replace(/\s+/g, " ").trim();
/** "quiero hablar con una persona", "un humano", "con el dueño": pide atención humana. */
export function pideHumano(texto: string): boolean {
  const n = norm(texto);
  if (n.split(" ").length > 14) return false;
  return /\b(hablar|conversar|comunicar(me)?|contactar(me)?|atender(me)?|pasame|pasenme|comunicame|llamen(me)?)\b.*\b(persona|humano|alguien|encargad[oa]|recepcion\w*|administrad\w+|due[nñ]o|asesor\w*|ejecutiv\w+|real)\b|\b(persona real|atencion humana|un humano|una persona|asesor humano)\b|\bno (eres|sos) (un )?(robot|bot)\b/.test(n);
}
/** Cancelar, cambiar, mover o reagendar una hora ya tomada. */
export function pideCambio(texto: string): boolean {
  const n = norm(texto);
  if (n.split(" ").length > 16) return false;
  return /\b(cancel\w*|anul\w*|reagend\w*|reprogram\w*)\b|\b(cambiar|cambio|mover|modificar|postergar|adelantar|atrasar)\b.*\b(hora|cita|dia|turno|reserva)\b|\bme equivoque de (dia|hora)\b|\bno (puedo|podre|alcanzo a) (ir|asistir|llegar)\b/.test(n);
}
export function textoCambio(datos: DatosFaq | null): string | null {
  return textoDerivacionTelefono(datos, "Para cambiar o cancelar tu hora: si reservaste por la web, en el correo de confirmación hay un botón para hacerlo. También puedes escribirle a una persona del equipo.");
}
/** Respuesta a lo que no es texto (foto, audio, documento...). null = no responder (reacciones, stickers, ubicación). */
export function textoNoTexto(tipo: string, datos: DatosFaq | null): string | null {
  if (["reaction", "sticker", "location", "contacts", "unsupported", "system", "request_welcome", "ephemeral"].includes(tipo)) return null;
  const intro = tipo === "audio" || tipo === "voice"
    ? "Por aquí solo puedo leer mensajes escritos. Escríbeme tu consulta o toca *menú* para ver las opciones."
    : "Recibí tu archivo, pero por aquí no puedo revisar fotos ni documentos. Si es para cotizar un servicio, una persona del equipo lo revisa:";
  return textoDerivacionTelefono(datos, intro) ?? (tipo === "audio" || tipo === "voice" ? intro : null);
}

// ---- Cierres de conversación y "sí" sueltos: se responden sin IA.
/** "gracias", "chao", "ok", "ya filo", "nos vemos": el cliente cierra la conversación. */
export function esCierreConversacion(texto: string): boolean {
  const n = norm(texto);
  if (!n || n.split(" ").length > 6) return false;
  return /^(ah |ya |ok |okey |bueno |bacan |genial |perfecto |super |filo )*(muchas )?(gracias|grax|gracia|chao|chau|adios|nos vemos|hasta luego|ya filo|filo|bacan|listo|ok|okey|ya po|nopo|nada)( po| nomas| no mas| igual| bro| hermano| amigo| gracias| por todo)*( chao| nos vemos| adios)?$/.test(n) && !/^(ya po|ok|okey|listo|bacan)$/.test(n);
}
export const TEXTO_CIERRE = "¡De nada! Si necesitas algo más, escribe *menú*. ¡Que estés muy bien!";
/** "sí", "dale", "ya po", "ok" sin una pregunta pendiente: no sabemos a qué dice que sí. */
export function esAfirmativoSuelto(texto: string): boolean {
  const n = norm(texto);
  return /^(si|sii+|sipo|dale|dale po|ya|ya po|ya dale|ok|okey|listo|bueno|claro|perfecto|vale)$/.test(n);
}
export const TEXTO_AFIRMATIVO_SUELTO = "¡Dale! ¿Te ayudo a reservar? Dime el día y la hora que te acomoda (por ejemplo «mañana a las 5») o toca *menú*.";
