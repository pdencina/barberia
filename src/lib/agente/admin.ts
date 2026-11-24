// Número administrador del agente de WhatsApp: el dueño escribe desde su número registrado y el agente NO lo trata como cliente.
//  - "reporte" / "reporte hoy" / "reporte mes": resumen de los indicadores, SOLO cuando lo pide.
//  - Cualquier otra frase es una instrucción (p. ej. "el viernes 27 cerramos a las 13:00"): se muestra y se pide confirmación (sí/no)
//    antes de guardarla como AVISO; así una frase suelta o un celular ajeno no cambia nada sin que el dueño lo confirme.
//  - "avisos" los lista; "borrar 2" quita uno.
// Un aviso solo INFORMA a los clientes que preguntan por horario u horas: no cierra la agenda real ni bloquea horas de la reserva web.
// Determinista (sin IA); lo único que se guarda es el texto del aviso y su fecha de término.
import { normalizar } from "./faq-fija";
import { ahoraChile, sumar, textoDeFecha, interpretarFecha } from "./disponibilidad";

export const VIGENCIA_AVISO_DIAS = 14; // si el aviso no trae fecha, dura 14 días
export const VIGENCIA_PENDIENTE_MIN = 30;
export const MAX_AVISO = 300;
export const MAX_AVISOS_ACTIVOS = 10;

export interface AvisoNegocio { id: string; texto: string; hasta: string }
export interface OperacionesAdmin {
  pendiente: (ahoraMs: number) => Promise<AvisoNegocio | null>;
  guardarPendiente: (texto: string, hasta: string) => Promise<void>;
  confirmar: (id: string) => Promise<void>;
  descartarPendientes: () => Promise<void>;
  activos: (hoy: string) => Promise<AvisoNegocio[]>;
  borrar: (id: string) => Promise<void>;
  /** Suma de cada indicador entre dos días (YYYY-MM-DD, ambos incluidos). */
  reporte: (desde: string, hasta: string) => Promise<Record<string, number>>;
}

const AFIRMATIVO = /^(?:si|sii+|dale|ok|okey|listo|confirmo|confirmado|guardalo|guardala|guardalo por favor|de acuerdo|claro)$/;
const NEGATIVO = /^(?:no|nop|cancelar|cancela|descartar|descartalo|olvidalo|mejor no)$/;
const AYUDA = "Hola, estás en el modo administrador de Estudio Levels.\n\n• *reporte*: resumen de los últimos 7 días (también *reporte hoy* o *reporte mes*)\n• *avisos*: lista de avisos vigentes\n• *borrar 2*: quita el aviso 2\n• Cualquier otra frase es una instrucción para el agente; por ejemplo: «el viernes 27 cerramos a las 13:00». Te la muestro y la guardo cuando confirmes con *sí*.\n\nLos avisos solo informan a los clientes que preguntan por horarios u horas; no bloquean la agenda.";

const limpiar = (s: string) => s.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim();

function fechaCorta(f: string, hoy: string) { return textoDeFecha(f, hoy); }

function textoReporte(r: Record<string, number>, titulo: string) {
  const n = (k: string) => r[k] ?? 0;
  return `📊 Reporte ${titulo}\n\n• Respuestas automáticas: ${n("respuestas_automaticas")}\n• Consultas de disponibilidad: ${n("consultas_disponibilidad")}\n• Horas ofrecidas: ${n("ofertas_horas")}\n• Reservas iniciadas por el chat: ${n("reservas_iniciadas")}\n• Reservas cerradas por el chat: ${n("reservas_cerradas")}\n• Derivadas a una persona: ${n("derivadas_persona")}`;
}

export async function manejarAdmin(texto: string, ops: OperacionesAdmin, ahoraMs: number): Promise<string> {
  const hoy = ahoraChile(ahoraMs).fecha;
  const t = normalizar(texto).replace(/[!¡¿?.,]+/g, " ").replace(/\s+/g, " ").trim();
  const original = limpiar(texto);

  if (/^(?:ayuda|menu|hola|buenas|buenos dias|buenas tardes|help)$/.test(t)) return AYUDA;

  // ---- reporte (solo cuando lo pide)
  if (/^(?:reporte|informe|resumen)\b/.test(t)) {
    const mes = /\bmes\b/.test(t), dia = /\bhoy\b/.test(t);
    const desde = dia ? hoy : mes ? `${hoy.slice(0, 8)}01` : sumar(hoy, -6);
    return textoReporte(await ops.reporte(desde, hoy), dia ? "de hoy" : mes ? "del mes" : "de los últimos 7 días");
  }

  // ---- avisos
  if (/^avisos?$/.test(t)) {
    const a = await ops.activos(hoy);
    if (a.length === 0) return "No hay avisos vigentes. Escríbeme una instrucción, por ejemplo: «el viernes 27 cerramos a las 13:00».";
    return `Avisos vigentes:\n${a.map((x, i) => `${i + 1}. ${x.texto} (hasta ${fechaCorta(x.hasta, hoy)})`).join("\n")}\n\nPara quitar uno: *borrar 1*.`;
  }
  const borrar = /^(?:borrar|quitar|eliminar)(?: aviso)? (\d{1,2})$/.exec(t);
  if (borrar) {
    const a = await ops.activos(hoy), x = a[Number(borrar[1]) - 1];
    if (!x) return `No encuentro el aviso ${borrar[1]}. Escribe *avisos* para verlos.`;
    await ops.borrar(x.id);
    return `Listo, quité el aviso ${borrar[1]}.`;
  }

  // ---- confirmación de una instrucción pendiente
  if (AFIRMATIVO.test(t) || NEGATIVO.test(t)) {
    const p = await ops.pendiente(ahoraMs);
    if (!p) return "No tengo ninguna instrucción pendiente. Escríbeme lo que quieres que informe a los clientes, o *ayuda*.";
    if (NEGATIVO.test(t)) { await ops.descartarPendientes(); return "Listo, no guardé nada."; }
    if ((await ops.activos(hoy)).length >= MAX_AVISOS_ACTIVOS) return `Ya hay ${MAX_AVISOS_ACTIVOS} avisos vigentes. Quita alguno con *borrar N* (mira la lista con *avisos*) y vuelve a confirmar.`;
    await ops.confirmar(p.id);
    return `Guardado ✅ Los clientes que pregunten por horarios u horas verán: «${p.texto}» (hasta ${fechaCorta(p.hasta, hoy)}).\n\nRecuerda que esto solo informa; la agenda de la reserva web no se bloquea.`;
  }

  // ---- una instrucción nueva: se muestra y se pide confirmación
  if (original.length < 8) return AYUDA;
  if (original.length > MAX_AVISO) return `Es muy largo (máximo ${MAX_AVISO} caracteres). Resúmelo y me lo vuelves a mandar.`;
  const f = interpretarFecha(original.toLowerCase().normalize("NFD").replace(/([aeiou])[\u0300-\u036f]+/g, "$1").normalize("NFC"), hoy); // conserva la ñ de "mañana"
  const hasta = f !== "invalida" && f.explicita ? f.fecha : sumar(hoy, VIGENCIA_AVISO_DIAS);
  await ops.guardarPendiente(original, hasta);
  return `Voy a informar esto a los clientes que pregunten por horarios u horas:\n\n«${original}»\n\nVigente hasta ${fechaCorta(hasta, hoy)}. ¿Lo guardo? Responde *sí* o *no*.`;
}

/** Solo las consultas de horario / horas / disponibilidad llevan los avisos (no el menú, el curso ni las derivaciones). */
const PIDE_HORARIO = /\b(horario|horarios|abren|abre|abrir|abierto|abiertos|cierran|cierra|cerrado|cerrados|atienden|atiende|atencion|hora|horas|disponib\w*|cupo|cupos|reserv\w*|agend\w*|feriado|feriados)\b/;
export function pideHorario(consulta: string): boolean { return PIDE_HORARIO.test(normalizar(consulta)); }
export function conAvisos(respuesta: string, avisos: string[]): string {
  const a = avisos.map(limpiar).filter(Boolean).slice(0, 3);
  return a.length ? `${respuesta}\n\n📌 ${a.map((x) => `Aviso: ${x}`).join("\n📌 ")}` : respuesta;
}
