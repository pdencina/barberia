// Consulta de disponibilidad por WhatsApp: "¿Matías tiene hora a las 3?", "¿qué horas tienen mañana?".
// Determinista y de SOLO LECTURA: no guarda nada ni pide datos personales. Las horas libres las calcula la misma función que
// usa la reserva web (inyectada), para no tener dos reglas distintas. Nunca repite el texto del cliente en la respuesta.
import { normalizar, mensajeAdmitido, datoSeguro, type DatosFaq } from "./faq-fija";
import { palabraCalza } from "./nombres";

export interface HorasLibres { slots: string[]; cerrado: boolean; fueraDeVentana: boolean }
export interface DependenciasDisponibilidad {
  ahora: () => number;
  horasLibres: (profesionalId: string, fecha: string, duracionMin: number) => Promise<HorasLibres>;
  /** Fecha de la oferta anterior: si el cliente no escribe fecha, se usa esta en vez de "hoy" y la respuesta sale más corta. */
  fechaPorDefecto?: string;
  /** Profesional de la oferta anterior (si fue uno solo): un seguimiento sin nombre ("en la tarde") se entiende con él. */
  profesionalPorDefecto?: string;
  /** Horas que ya se le dieron: "más tarde" / "más temprano" se miden contra ellas. */
  horasOfrecidas?: string[];
}
// Lo que se le ofreció al cliente, para que su siguiente mensaje ("quiero la de las 15:15") se entienda sin que nadie intervenga.
// No guarda texto del cliente: solo profesional, fecha y horas libres ofrecidas.
export interface OpcionOfrecida { id: string; nombre: string; duracionMin: number; fecha: string; horas: string[] }
export interface Oferta { horaExacta: string | null; opciones: OpcionOfrecida[] }
export type ResultadoDisponibilidad = { tipo: "respuesta"; texto: string; oferta?: Oferta } | { tipo: "sin_consulta" };

export const MAX_HORAS_OFRECIDAS = 40;
const SIN: ResultadoDisponibilidad = { tipo: "sin_consulta" };
export const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"] as const;
export const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"] as const;
const DIAS_CLAVE: Record<string, number> = { domingo: 0, lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6 };
const NUMEROS: Record<string, number> = { una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12 };
const MAX_PROFESIONALES = 12, MAX_DIAS_ADELANTE = 7, DURACION_BASE = 45;

type Franja = "manana" | "tarde" | "noche";
const RANGOS: Record<Franja, [number, number]> = { manana: [0, 12 * 60], tarde: [12 * 60, 19 * 60], noche: [19 * 60, 24 * 60] };

// ---------- fechas (calendario civil de Chile, sin depender de la zona del servidor)
const formatoChile = new Intl.DateTimeFormat("en-GB", { timeZone: "America/Santiago", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
export function ahoraChile(ms: number): { fecha: string; minutos: number } {
  const p = formatoChile.formatToParts(new Date(ms)), g = (t: string) => p.find((x) => x.type === t)!.value;
  return { fecha: `${g("year")}-${g("month")}-${g("day")}`, minutos: Number(g("hour")) * 60 + Number(g("minute")) };
}
const dias = (fecha: string) => { const [y, m, d] = fecha.split("-").map(Number); return Date.UTC(y, m - 1, d) / 86_400_000; };
const desdeDias = (n: number) => { const d = new Date(n * 86_400_000); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`; };
export const sumar = (fecha: string, n: number) => desdeDias(dias(fecha) + n);
export const diaSemana = (fecha: string) => (((dias(fecha) + 4) % 7) + 7) % 7;
const fechaValida = (y: number, m: number, d: number) => { const t = new Date(Date.UTC(y, m - 1, d)); return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d; };
export const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

// "hoy", "mañana" o "el viernes 6 de noviembre", respecto de la fecha de hoy en Chile.
export function textoDeFecha(f: string, hoy: string): string {
  return f === hoy ? "hoy" : f === sumar(hoy, 1) ? "mañana" : `el ${DIAS[diaSemana(f)]} ${Number(f.slice(8, 10))} de ${MESES[Number(f.slice(5, 7)) - 1]}`;
}

// ---------- interpretación del mensaje
interface Consulta { fecha: string; fechaExplicita: boolean; hora: number | null; franja: Franja | null; profesionales: Perfil[]; relativo: "despues" | "antes" | null; rango?: { d: number; h: number; puntos: boolean } }
interface Perfil { id: string; nombre: string; link: string; duracionMin: number }

export function interpretarFecha(t: string, hoy: string): { fecha: string; explicita: boolean; resto: string } | "invalida" {
  let resto = t;
  if (/\bpasado mañana\b/.test(resto)) return { fecha: sumar(hoy, 2), explicita: true, resto: resto.replace(/\bpasado mañana\b/, " ") };
  if (/\bmañana\b/.test(resto)) return { fecha: sumar(hoy, 1), explicita: true, resto: resto.replace(/\bmañana\b/, " ") };
  if (/\b(hoy|ahora|ahorita)\b/.test(resto)) return { fecha: hoy, explicita: true, resto: resto.replace(/\b(hoy|ahora|ahorita)\b/, " ") };
  const dia = /\b(?:el |este |proximo |próximo )?(lunes|martes|miercoles|jueves|viernes|sabado|domingo)\b/.exec(resto);
  if (dia) {
    const objetivo = DIAS_CLAVE[dia[1]], actual = diaSemana(hoy);
    return { fecha: sumar(hoy, (objetivo - actual + 7) % 7), explicita: true, resto: resto.replace(dia[0], " ") };
  }
  const num = /\b(?:el )?(\d{1,2}) de (enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\b/.exec(resto) ?? /\bel (\d{1,2})\b(?! ?(?::|h\b|am\b|pm\b|hrs\b))/.exec(resto);
  if (num) {
    const d = Number(num[1]); let [y, m] = hoy.split("-").map(Number);
    if (num[2]) {
      m = MESES.indexOf(num[2] as (typeof MESES)[number]) + 1;
      if (!fechaValida(y, m, d)) return "invalida";
      let f = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      if (f < hoy) { y += 1; if (!fechaValida(y, m, d)) return "invalida"; f = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`; }
      return { fecha: f, explicita: true, resto: resto.replace(num[0], " ") };
    }
    const hoyDia = Number(hoy.split("-")[2]);
    if (d < hoyDia) { m += 1; if (m === 13) { m = 1; y += 1; } }
    if (!fechaValida(y, m, d)) return "invalida";
    return { fecha: `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`, explicita: true, resto: resto.replace(num[0], " ") };
  }
  return { fecha: hoy, explicita: false, resto };
}

// Hora pedida en minutos desde medianoche, o null. Sin am/pm: 1 a 8 se entiende de tarde, 9 a 11 de mañana.
function interpretarHora(t: string, franja: Franja | null): number | null | "invalida" {
  let h: number | null = null, m = 0, meridiano: string | null = null, hallada = false;
  const palabra = /\ba las? (una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce)\b(?: y (media|cuarto))?/.exec(t);
  const r1 = /\b(?:a la|a las|tipo|como a la|como a las|para la|para las|a eso de las|alrededor de las)\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm|hrs|hs|h)?\b/.exec(t);
  const r2 = /\b(\d{1,2}):(\d{2})\s*(am|pm|hrs|hs|h)?\b/.exec(t);
  const r3 = /\b(\d{1,2})\s*(am|pm)\b/.exec(t);
  if (/\bmediodia\b/.test(t)) { h = 12; hallada = true; }
  else if (palabra) { h = NUMEROS[palabra[1]]; m = palabra[2] === "media" ? 30 : palabra[2] === "cuarto" ? 15 : 0; hallada = true; }
  else if (r1) { h = Number(r1[1]); m = r1[2] ? Number(r1[2]) : 0; meridiano = r1[3] ?? null; hallada = true; }
  else if (r2) { h = Number(r2[1]); m = Number(r2[2]); meridiano = r2[3] ?? null; hallada = true; }
  else if (r3) { h = Number(r3[1]); meridiano = r3[2]; hallada = true; }
  if (!hallada) return null;
  if (h === null || h < 0 || h > 23 || m < 0 || m > 59) return "invalida";
  if (meridiano === "pm" && h < 12) h += 12;
  else if (meridiano === "am" && h === 12) h = 0;
  else if (!meridiano && h >= 1 && h <= 11) {
    if (franja === "tarde" || franja === "noche") h += 12;
    else if (franja !== "manana" && h <= 8) h += 12;
  }
  if (h === 0) return "invalida";
  return h * 60 + m;
}

// "entre las 14 o las 15 hrs", "a las 14 o a las 15", "entre las 14 y las 16": un tramo de horas en vez de una hora suelta.
// Sin am/pm: 1 a 8 se entiende de tarde (como en las horas sueltas); si la franja dice "mañana", se respeta.
function interpretarRango(t: string, franja: Franja | null): { d: number; h: number; puntos: boolean } | null {
  const m = /\b(?:entre|a)\s+las?\s+(\d{1,2})(?::(\d{2}))?\s*(?:hrs|hs|h)?\s+(y|o|e|a)\s+(?:a\s+)?(?:las?\s+)?(\d{1,2})(?::(\d{2}))?\s*(?:hrs|hs|h)?\b/.exec(t);
  if (!m) return null;
  const conv = (h: number, mi: number) => (h >= 1 && h <= 8 && franja !== "manana") || ((franja === "tarde" || franja === "noche") && h >= 1 && h <= 11) ? h + 12 : h;
  const h1 = Number(m[1]), h2 = Number(m[4]), m1 = m[2] ? Number(m[2]) : 0, m2 = m[5] ? Number(m[5]) : 0;
  if (h1 > 23 || h2 > 23 || m1 > 59 || m2 > 59) return null;
  const a = conv(h1, m1) * 60 + m1, b = conv(h2, m2) * 60 + m2;
  const [desde, hasta] = a <= b ? [a, b] : [b, a];
  return desde > 0 && hasta - desde <= 6 * 60 ? { d: desde, h: hasta, puntos: m[3] === "o" } : null;
}

function perfilesDe(datos: DatosFaq | null): Perfil[] {
  const lista = Array.isArray(datos?.profesionales) ? datos!.profesionales! : [];
  return lista
    .filter((p) => p && typeof p.id === "string" && p.id && datoSeguro(p.nombre) && datoSeguro(p.link))
    .slice(0, MAX_PROFESIONALES)
    .map((p) => ({ id: p.id!, nombre: p.nombre.trim(), link: p.link.trim(), duracionMin: Number.isInteger(p.duracionMin) && p.duracionMin! >= 5 && p.duracionMin! <= 240 ? p.duracionMin! : DURACION_BASE }));
}
const sinTildes = (s: string) => s.normalize("NFD").replace(/([aeiou])[̀-ͯ]+/g, "$1").normalize("NFC").toLowerCase();

function profesionalesMencionados(t: string, perfiles: Perfil[]): Perfil[] {
  const palabras = Array.from(new Set(t.split(/[^a-zñ0-9]+/).filter((w) => w.length >= 3)));
  // Gana quien calza con más palabras del nombre ("dylan perez" es Dylan Perez, no Enzo Perez, aunque compartan el apellido).
  const puntaje = (p: Perfil) => sinTildes(p.nombre).split(" ").filter((x) => x.length >= 3).filter((tok) => palabras.some((w) => palabraCalza(w, tok))).length;
  const pts = perfiles.map(puntaje), max = Math.max(0, ...pts);
  const coinciden = max > 0 ? perfiles.filter((_, i) => pts[i] === max) : [];
  return coinciden.length > 0 && coinciden.length <= 3 ? coinciden : [];
}

const PRIMER_DISPONIBLE = /\b(primer(o)? (profesional )?disponible|cualquier(a)? (profesional|barbero)|con quien sea|quien tenga (hora|disponible))\b/;
const PALABRA_HORA = /\b(hora|horas|cupo|cupos|disponib\w*|libre|libres|espacio|espacios|hueco|huecos|atiende|atienden|tiene|tienen|hay|queda|quedan|puede|pueden|agendar|reservar|cita|turno)\b/;
const PREGUNTA_HORARIO = /\b(abren|abre|abrir|abierto|abiertos|cierran|cierra|cerrar|cerrado|atencion|horario|horarios)\b/;
const NO_CONSULTA = /\b(cancelar|cancelo|cancela|anular|anulo|anula|cambiar|cambio|cambia|reagendar|reprogramar|mover|modificar|cuanto|cuesta|cuestan|precio|precios|valor|vale|descuento)\b/;

function interpretar(t: string, hoy: string, perfiles: Perfil[], seguimiento = false): Consulta | null {
  if (PREGUNTA_HORARIO.test(t) || NO_CONSULTA.test(t)) return null;
  let franja: Franja | null = null;
  // Tras una oferta, "tarde" / "noche" / "y en la tarde" sueltos piden esa franja con la misma persona y fecha (antes caían en las preguntas frecuentes).
  if (seguimiento) {
    const solo = /^(?:y\s+)?(?:(?:en|por|para|de)\s+la\s+)?(tarde|noche)(?:\s+nom[aá]s|\s+no m[aá]s|\s+porfa|\s+por favor)?[\s?!.]*$/.exec(t.trim());
    if (solo) franja = solo[1] as Franja;
  }
  let texto = t.replace(/\b(?:en|por|de|durante|esta) la (mañana|tarde|noche)\b/g, (_, f: string) => { franja = f === "mañana" ? "manana" : (f as Franja); return " "; });
  texto = texto.replace(/\besta (mañana|tarde|noche)\b/g, (_, f: string) => { franja = f === "mañana" ? "manana" : (f as Franja); return " hoy "; });
  if (/\btemprano\b/.test(texto) && !/\bm[aá]s temprano\b/.test(texto)) { franja = "manana"; texto = texto.replace(/\btemprano\b/, " "); }
  // Seguimiento de una oferta: "tarde", "de tarde", "tarde porfa" o "noche" a secas son un horario (no "más tarde", que se mide contra las horas ya dadas).
  if (seguimiento && !franja) {
    const suelta = /(?<!m[aá]s )(?<![a-zñáéíóú])(tarde|noche)\b/.exec(texto);
    if (suelta) { franja = suelta[1] as Franja; texto = texto.replace(suelta[0], " "); }
  }
  const f = interpretarFecha(texto, hoy);
  if (f === "invalida") return null;
  const rango = interpretarRango(f.resto, franja);
  const hora = rango ? rango.d : interpretarHora(f.resto, franja);
  if (hora === "invalida") return null;
  const mencionados = profesionalesMencionados(t, perfiles);
  const generica = PRIMER_DISPONIBLE.test(t) || /\b(tienen|tiene|hay|quedan|queda|alguna|algun)\b.*\b(hora|horas|cupo|cupos|espacio|espacios)\b|\b(hora|horas|cupo|cupos)\b.*\b(disponible|disponibles)\b/.test(t);
  const rel = /\bm[aá]s (tarde|temprano)\b/.exec(t);
  const relativo: "despues" | "antes" | null = rel ? (rel[1] === "tarde" ? "despues" : "antes") : null;
  // Con una oferta reciente, un horario suelto ("en la tarde", "a las 4", "más tarde") se entiende como seguimiento.
  const pide = PRIMER_DISPONIBLE.test(t) || (mencionados.length > 0 && hora !== null) || (PALABRA_HORA.test(t) && (mencionados.length > 0 || f.explicita || hora !== null || franja !== null || generica)) || (seguimiento && (franja !== null || hora !== null || relativo !== null || (f.explicita && t.split(" ").length <= 6)));
  if (!pide) return null;
  return { fecha: f.fecha, fechaExplicita: f.explicita, hora, franja, profesionales: mencionados, relativo, ...(rango ? { rango } : {}) };
}

// ---------- redacción (pensada para leerse bien en WhatsApp: nombres en negrita, una idea por línea, link en su propia línea)
const MAX_HORAS = 3, MAX_HORAS_DIA = 6, MAX_OTROS = 3, MAX_PROFESIONALES_LISTA = 3;
const nombreNegrita = (n: string) => `*${n}*`;
const horasTxt = (a: string[]) => a.join(" · ");
const mayus = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
const minutosDe = (h: string) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5));
// Las horas más cercanas a la pedida (o las primeras si no pidió hora), en orden cronológico.
function cercanos(horas: string[], hora: number | null, max: number): string[] {
  if (horas.length <= max) return horas.slice(0, max);
  if (hora === null) return horas.slice(0, max);
  return horas.slice().sort((a, b) => Math.abs(minutosDe(a) - hora) - Math.abs(minutosDe(b) - hora)).slice(0, max).sort();
}
const horasDe = (r: HorasLibres, franja: Franja | null) => r.slots.map((s) => s.slice(11, 16)).filter((h) => {
  if (!franja) return true;
  const m = minutosDe(h); return m >= RANGOS[franja][0] && m < RANGOS[franja][1];
});
const bloque = (...partes: Array<string | null | false>) => partes.filter((x): x is string => !!x).join("\n\n");

async function responderDisponibilidadBase(texto: unknown, datos: DatosFaq | null, deps: DependenciasDisponibilidad): Promise<ResultadoDisponibilidad> {
  let t = mensajeAdmitido(texto);
  // En un seguimiento, la pregunta "¿Más tarde no tienen?" lleva un "no" que el filtro rechaza: se lee sin él.
  if (!t && deps.fechaPorDefecto && typeof texto === "string" && /\?\s*$/.test(texto.trim())) t = mensajeAdmitido(texto.replace(/\bno\b/gi, " "));
  if (!t) return SIN;
  const perfiles = perfilesDe(datos);
  if (perfiles.length === 0) return SIN;
  // Solo el nombre de un profesional ("felipe meza", "con Matías"): se entiende como "¿tiene horas?" y se le muestran las suyas.
  {
    const sinCon = sinTildes(t).replace(/^(?:con|para|quiero con|quiero hora con|hora con|agendame con|agendame|me agendas con)\s+/, "").trim();
    const ws = sinCon.split(/\s+/).filter(Boolean);
    if (ws.length >= 1 && ws.length <= 3) {
      const dueños = perfiles.filter((p) => { const toks = sinTildes(p.nombre).split(" ").filter((x) => x.length >= 3); return ws.every((w) => toks.some((tok) => palabraCalza(w, tok))); });
      if (dueños.length === 1) t = `${sinTildes(dueños[0].nombre)} tiene hora`;
    }
  }
  const ahora = ahoraChile(deps.ahora());
  const seguimiento = !!deps.fechaPorDefecto;
  const q = interpretar(t, ahora.fecha, perfiles, seguimiento);
  if (!q) return SIN;
  if (seguimiento && q.profesionales.length === 0 && deps.profesionalPorDefecto) {
    const previo = perfiles.find((x) => x.id === deps.profesionalPorDefecto);
    if (previo) q.profesionales = [previo];
  }
  if (!q.fechaExplicita && deps.fechaPorDefecto) q.fecha = deps.fechaPorDefecto;
  const general = datos?.negocio.linkReserva && datoSeguro(datos.negocio.linkReserva) ? datos.negocio.linkReserva.trim() : null;
  const completa = (f: string) => `${DIAS[diaSemana(f)]} ${Number(f.slice(8, 10))} de ${MESES[Number(f.slice(5, 7)) - 1]}`;
  // "mañana" lleva la fecha: pasada la medianoche, "mañana" puede ser el mismo día para quien escribe.
  const dia = (f: string) => (f === ahora.fecha ? "hoy" : f === sumar(ahora.fecha, 1) ? `mañana (${completa(f)})` : `el ${completa(f)}`);
  const notaMadrugada = ahora.minutos < 6 * 60 && q.fecha === sumar(ahora.fecha, 1) ? "¿O a qué día te refieres?" : null;
  const conNota = (c: string) => (notaMadrugada ? `${notaMadrugada}\n\n${c}` : c);
  const ofrecidas = (deps.horasOfrecidas ?? []).map(minutosDe);
  const aplicarRelativo = (horas: string[]) => {
    if (!q.relativo || ofrecidas.length === 0) return horas;
    return q.relativo === "despues" ? horas.filter((h) => minutosDe(h) > Math.max(...ofrecidas)) : horas.filter((h) => minutosDe(h) < Math.min(...ofrecidas));
  };
  // "Más tarde" / "más temprano" se miden contra las horas ya dadas, que son de la fecha de la oferta: otros días no se filtran.
  const horasQ = (r: HorasLibres, f: string = q.fecha) => (f === q.fecha ? aplicarRelativo(horasDe(r, q.franja)) : horasDe(r, q.franja));
  const franjaTxt = q.franja === "manana" ? " en la mañana" : q.franja === "tarde" ? " en la tarde" : q.franja === "noche" ? " en la noche" : "";
  const consultar = async (p: Perfil, f: string): Promise<HorasLibres> => deps.horasLibres(p.id, f, p.duracionMin);
  const consultarTodos = (ps: Perfil[], f: string) => Promise.all(ps.map(async (p) => ({ p, r: await consultar(p, f) })));
  const hh = q.hora === null ? null : hhmm(q.hora);
  const fueraDeVentana = (enlace: string, de: string) => `Esa fecha todavía no está abierta para reservar.\n\nPuedes ver las fechas disponibles${de} aquí:\n${enlace}`;

  // ---- con un profesional concreto
  if (q.profesionales.length === 1) {
    const P = q.profesionales[0], N = nombreNegrita(P.nombre);
    const r = await consultar(P, q.fecha);
    if (r.fueraDeVentana) return { tipo: "respuesta", texto: fueraDeVentana(P.link, ` de ${P.nombre}`) };
    const propias = horasQ(r);
    // Con una sola hora basta un "sí"; con varias hay que decir cuál (un "sí" no sabría elegir).
    const cierreCon = (varias: boolean) => conNota(varias
      ? `¿Quieres que te agende? Dime a qué hora y te pido tus datos.\nO reserva tú aquí: ${P.link}`
      : `¿Quieres que te agende? Responde *sí* y te pido tus datos.\nO reserva tú aquí: ${P.link}`);
    const cierre = cierreCon(hh === null && propias.length > 1);
    // ---- un tramo ("entre las 14 o las 15"): primero las horas dentro del tramo; si no hay, las cercanas; si no, las más próximas del día
    if (q.rango && propias.length > 0) {
      const { d, h, puntos } = q.rango, centro = (d + h) / 2;
      const ofertaR = { horaExacta: null, opciones: [{ id: P.id, nombre: P.nombre, duracionMin: P.duracionMin, fecha: q.fecha, horas: propias.slice(0, MAX_HORAS_OFRECIDAS) }] };
      const lista = (hs: string[]) => hs.map((x) => `*${x}*`).join(" / ");
      const pick = (hs: string[]) => hs.slice().sort((a, b) => Math.abs(minutosDe(a) - centro) - Math.abs(minutosDe(b) - centro)).slice(0, 3).sort();
      // "14 o 15" son dos horas puntuales; "entre las 14 y las 16" es un tramo completo.
      const dentro = propias.filter((x) => (puntos ? minutosDe(x) === d || minutosDe(x) === h : minutosDe(x) >= d && minutosDe(x) <= h));
      const cerca = propias.filter((x) => minutosDe(x) >= d - 45 && minutosDe(x) <= h + 45);
      const enlace = `También te dejamos el link de ${P.nombre.split(" ")[0]} para que veas los horarios disponibles:\n${P.link}`;
      if (dentro.length > 0) return { tipo: "respuesta", texto: conNota(bloque(`Sí, tenemos disponible ${dia(q.fecha)} a las ${lista(pick(dentro))}.\n¿Qué horario te gustaría reservar?`, enlace)), oferta: ofertaR };
      if (cerca.length > 0) return { tipo: "respuesta", texto: conNota(bloque(`Sí, tenemos disponible ${dia(q.fecha)} a las ${lista(pick(cerca))}.\n¿Qué horario te gustaría reservar?`, enlace)), oferta: ofertaR };
      return { tipo: "respuesta", texto: conNota(bloque(`Lo siento, no tenemos en ese horario. Lo más cercano ${dia(q.fecha)} es a las ${lista(pick(propias))}.\n¿Te sirve alguna de estas?`, enlace)), oferta: ofertaR };
    }
    if (hh !== null && propias.includes(hh)) {
      const otras = cercanos(propias.filter((h) => h !== hh), q.hora, MAX_HORAS);
      return { tipo: "respuesta", texto: bloque(`Sí, ${N} tiene disponible ${dia(q.fecha)} a las *${hh}*.`, otras.length > 0 && `También tiene: ${horasTxt(otras)}`, cierre), oferta: { horaExacta: hh, opciones: [{ id: P.id, nombre: P.nombre, duracionMin: P.duracionMin, fecha: q.fecha, horas: propias.slice(0, MAX_HORAS_OFRECIDAS) }] } };
    }
    if (hh === null && propias.length) {
      const oferta = { horaExacta: null, opciones: [{ id: P.id, nombre: P.nombre, duracionMin: P.duracionMin, fecha: q.fecha, horas: propias.slice(0, MAX_HORAS_OFRECIDAS) }] };
      if (propias.length > MAX_HORAS_DIA && !q.franja && !q.relativo) {
        // Muchas horas: no se listan; se confirma y se pregunta el horario.
        const resumen = `Sí, ${N} tiene horas ${dia(q.fecha)}.\n¿En qué horario buscas? (en la mañana, en la tarde o una hora, por ejemplo «a las 15:00»)`;
        return { tipo: "respuesta", texto: bloque(resumen, conNota(`Te dejo su link para que veas todos los horarios:\n${P.link}`)), oferta };
      }
      const lista = `${N} tiene disponible ${dia(q.fecha)}${franjaTxt}:\n${horasTxt(propias.slice(0, MAX_HORAS_DIA))}${propias.length > MAX_HORAS_DIA ? ` · y ${propias.length - MAX_HORAS_DIA} más` : ""}`;
      return { tipo: "respuesta", texto: bloque(lista, cierre), oferta };
    }
    if (hh === null && propias.length === 0 && (q.franja || q.relativo)) {
      const todas = horasDe(r, null);
      if (todas.length) {
        const oferta = { horaExacta: null, opciones: [{ id: P.id, nombre: P.nombre, duracionMin: P.duracionMin, fecha: q.fecha, horas: todas.slice(0, MAX_HORAS_OFRECIDAS) }] };
        if (q.relativo) {
          const tope = q.relativo === "despues" ? Math.max(...ofrecidas) : Math.min(...ofrecidas);
          const hhmmTope = `${String(Math.floor(tope / 60)).padStart(2, "0")}:${String(tope % 60).padStart(2, "0")}`;
          return { tipo: "respuesta", texto: bloque(`${N} no tiene horas ${q.relativo === "despues" ? "más tarde" : "más temprano"} de las ${hhmmTope} ${dia(q.fecha)}.`, conNota(`O revisa sus horas aquí: ${P.link}`)), oferta };
        }
        // Pidió un horario en el que no atiende: no se lista el resto del día; se dice cuál es lo más cercano.
        const [desde, hasta] = RANGOS[q.franja as Franja];
        const cerca = cercanos(todas, Math.round((desde + hasta) / 2), 2).map((h) => `*${h}*`).join(" y a las ");
        const texto = `${N} no tiene horas disponibles${franjaTxt} ${dia(q.fecha)}.\nLas más cercanas son a las ${cerca}.\nDime a cuál prefieres y te pido tus datos.\nO revisa sus horas aquí: ${P.link}`;
        return { tipo: "respuesta", texto: conNota(texto), oferta };
      }
    }
    let cabecera: string, siguiente: string | null = null;
    const opciones: OpcionOfrecida[] = [];
    if (propias.length && hh !== null) {
      const cerca = cercanos(propias, q.hora, 2).map((h) => `*${h}*`).join(" y a las ");
      const corto = `${N} no tiene a las ${hh} ${dia(q.fecha)}, pero sí a las ${cerca}.\nDime a cuál prefieres y te pido tus datos.\nO revisa sus horas aquí: ${P.link}`;
      return { tipo: "respuesta", texto: conNota(corto), oferta: { horaExacta: null, opciones: [{ id: P.id, nombre: P.nombre, duracionMin: P.duracionMin, fecha: q.fecha, horas: propias.slice(0, MAX_HORAS_OFRECIDAS) }] } };
    }
    if (propias.length) { cabecera = `A las ${hh} ${N} no tiene hora ${dia(q.fecha)}.\nHoras más cercanas: ${horasTxt(cercanos(propias, q.hora, MAX_HORAS))}`; opciones.push({ id: P.id, nombre: P.nombre, duracionMin: P.duracionMin, fecha: q.fecha, horas: propias.slice(0, MAX_HORAS_OFRECIDAS) }); }
    else {
      cabecera = r.cerrado ? `${N} no atiende ${dia(q.fecha)}.` : `${N} no tiene horas disponibles ${dia(q.fecha)}.`;
      let prox: { f: string; horas: string[] } | null = null;
      for (let i = 1; i <= MAX_DIAS_ADELANTE && !prox; i++) {
        const f = sumar(q.fecha, i), rr = await consultar(P, f);
        if (rr.fueraDeVentana) break;
        const horas = horasQ(rr, f);
        if (horas.length) prox = { f, horas };
      }
      if (prox) { siguiente = `Su próxima disponibilidad es ${dia(prox.f)}:\n${horasTxt(cercanos(prox.horas, q.hora, MAX_HORAS))}`; opciones.push({ id: P.id, nombre: P.nombre, duracionMin: P.duracionMin, fecha: prox.f, horas: prox.horas.slice(0, MAX_HORAS_OFRECIDAS) }); }
      else if (r.cerrado) siguiente = "No tiene horas disponibles en los próximos días.";
      else cabecera = `${N} no tiene horas disponibles ${dia(q.fecha)} ni en los próximos días.`;
    }
    const otros = (await consultarTodos(perfiles.filter((p) => p.id !== P.id), q.fecha))
      .map(({ p, r: rr }) => ({ p, horas: horasQ(rr) })).filter((x) => x.horas.length > 0)
      .sort((a, b) => Number(b.horas.includes(hh ?? "")) - Number(a.horas.includes(hh ?? "")))
      .slice(0, MAX_OTROS);
    const bloqueOtros = otros.length ? `Otros profesionales disponibles ${dia(q.fecha)}:\n${otros.map((x) => `• ${nombreNegrita(x.p.nombre)}: ${horasTxt(cercanos(x.horas, q.hora, MAX_HORAS))}`).join("\n")}` : null;
    for (const x of otros) opciones.push({ id: x.p.id, nombre: x.p.nombre, duracionMin: x.p.duracionMin, fecha: q.fecha, horas: x.horas.slice(0, MAX_HORAS_OFRECIDAS) });
    return { tipo: "respuesta", texto: bloque(cabecera, siguiente, !seguimiento && bloqueOtros, cierreCon(opciones.reduce((a, o) => a + o.horas.length, 0) > 1), !seguimiento && otros.length > 0 && general && `O elige a otro profesional aquí:\n${general}`), ...(opciones.length > 0 ? { oferta: { horaExacta: null, opciones } } : {}) };
  }

  // ---- sin profesional (o varios con el mismo nombre): se revisan todos
  if (!general) return SIN;
  const revisados = q.profesionales.length > 1 ? q.profesionales : perfiles;
  const dia1 = await consultarTodos(revisados, q.fecha);
  if (dia1.some(({ r }) => r.fueraDeVentana)) return { tipo: "respuesta", texto: fueraDeVentana(general, "") };
  const con = dia1.map(({ p, r }) => ({ p, horas: horasQ(r) })).filter((x) => x.horas.length > 0);
  const cierre = conNota(`¿Quieres que te agende? Dime con quién y a qué hora (por ejemplo: «Matías a las 19:00») y te pido tus datos.\nO reserva tú aquí: ${general}`);
  const filas = (xs: typeof con) => xs.slice(0, 5).map((x) => `• ${nombreNegrita(x.p.nombre)}: ${horasTxt(cercanos(x.horas, q.hora, MAX_HORAS))}`).join("\n");
  if (hh !== null) {
    const exactos = con.filter((x) => x.horas.includes(hh));
    if (exactos.length) return { tipo: "respuesta", texto: bloque(`A las *${hh}* ${dia(q.fecha)} tienen disponible:\n${exactos.slice(0, 5).map((x) => `• ${nombreNegrita(x.p.nombre)}`).join("\n")}`, cierre), oferta: { horaExacta: hh, opciones: exactos.slice(0, 5).map((x) => ({ id: x.p.id, nombre: x.p.nombre, duracionMin: x.p.duracionMin, fecha: q.fecha, horas: x.horas.slice(0, MAX_HORAS_OFRECIDAS) })) } };
  }
  // Sin hora ni profesional ("¿tienen hora hoy?", "¿quién atiende el miércoles?"): solo QUIÉN tiene horas, sin listar horarios (abruma).
  // Quien está cerrado todo el día (bloqueo manual) o ya no tiene horas por la hora actual no aparece: no devuelve horas libres.
  if (con.length && hh === null) {
    const corto = (n: string) => nombreNegrita(n.trim().split(" ").slice(0, 2).join(" "));
    const primera = con.map((x) => x.horas[0]).sort()[0];
    const resumen = `${mayus(dia(q.fecha))}${franjaTxt} tienen horas disponibles:\n${con.slice(0, 12).map((x) => `• ${corto(x.p.nombre)}`).join("\n")}\n\nLa primera hora libre es a las *${primera}*.\n¿Con quién te agendo? Dime el nombre (y la hora si ya tienes una en mente) y te muestro sus horas.`;
    return { tipo: "respuesta", texto: bloque(resumen, conNota(`O reserva tú aquí: ${general}`)), oferta: { horaExacta: null, opciones: con.slice(0, 12).map((x) => ({ id: x.p.id, nombre: x.p.nombre, duracionMin: x.p.duracionMin, fecha: q.fecha, horas: x.horas.slice(0, MAX_HORAS_OFRECIDAS) })) } };
  }
  if (con.length) return { tipo: "respuesta", texto: bloque(hh !== null ? `A las ${hh} no hay hora ${dia(q.fecha)}.\nHoras más cercanas:\n${filas(con)}` : `Hay disponibilidad ${dia(q.fecha)}${franjaTxt}${con.some((x) => x.horas.length > MAX_HORAS) ? ". Las horas más próximas:" : ":"}\n${filas(con)}`, cierre), oferta: { horaExacta: null, opciones: con.slice(0, 5).map((x) => ({ id: x.p.id, nombre: x.p.nombre, duracionMin: x.p.duracionMin, fecha: q.fecha, horas: x.horas.slice(0, MAX_HORAS_OFRECIDAS) })) } };
  for (let i = 1; i <= MAX_DIAS_ADELANTE; i++) {
    const f = sumar(q.fecha, i), dia2 = await consultarTodos(revisados, f);
    if (dia2.some(({ r }) => r.fueraDeVentana)) break;
    const siguiente = dia2.map(({ p, r }) => ({ p, horas: horasQ(r, f) })).filter((x) => x.horas.length > 0);
    if (siguiente.length) return { tipo: "respuesta", texto: bloque(`${mayus(dia(q.fecha))} no hay horas disponibles.`, `La próxima disponibilidad es ${dia(f)}:\n${filas(siguiente)}`, cierre), oferta: { horaExacta: null, opciones: siguiente.slice(0, 5).map((x) => ({ id: x.p.id, nombre: x.p.nombre, duracionMin: x.p.duracionMin, fecha: f, horas: x.horas.slice(0, MAX_HORAS_OFRECIDAS) })) } };
  }
  return { tipo: "respuesta", texto: bloque(`No hay horas disponibles ${dia(q.fecha)} ni en los próximos días.`, `Puedes revisar la agenda aquí:\n${general}`) };
}

/** En Chile "a las 6", "a las 06:00" o "a las 7" suelen ser las 18:00 y las 19:00. Sin am/pm ni "de la mañana/tarde/noche", de 1 a 8 se toma como de la tarde; aquí se le avisa al cliente cómo se entendió. */
export function notaHoraAmbigua(texto: unknown): string | null {
  if (typeof texto !== "string") return null;
  const t = texto.toLowerCase().normalize("NFD").replace(/([aeiou])[\u0300-\u036f]+/g, "$1").normalize("NFC");
  if (/\b(am|pm|a\.m\.|p\.m\.)\b|\b(de la|en la|por la|esta)\s+(manana|mañana|tarde|noche)\b|\bmediodia\b|\b(temprano|madrugada)\b/.test(t)) return null;
  const m = /\b(?:a la|a las|tipo|como a la|como a las|para la|para las|a eso de las|alrededor de las)\s+0?([1-8])(?::([0-5]\d))?\s*(?:hrs|hs|h)?\b(?!\s*(?:de diciembre|de noviembre|de enero))/.exec(t) ?? /\b0([1-8]):([0-5]\d)\b/.exec(t) ?? /\b([1-8]):([0-5]\d)\b/.exec(t);
  if (!m) return null;
  const h = Number(m[1]), min = m[2] ? m[2] : "00";
  return `Ojo: entendí *las ${h}${min !== "00" ? ":" + min : ""}* como las *${h + 12}:${min}* (${h} de la tarde). Si te referías a la mañana, dime.`;
}

export async function responderDisponibilidad(texto: unknown, datos: DatosFaq | null, deps: DependenciasDisponibilidad): Promise<ResultadoDisponibilidad> {
  const r = await responderDisponibilidadBase(texto, datos, deps);
  if (r.tipo !== "respuesta") return r;
  const nota = notaHoraAmbigua(texto);
  return nota ? { ...r, texto: `${nota}\n\n${r.texto}` } : r;
}
