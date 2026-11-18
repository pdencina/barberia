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
