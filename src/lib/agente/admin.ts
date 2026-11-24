// Número administrador del agente de WhatsApp. SOLO el número registrado (tabla agent_admin_contacts, comparado con el remitente que
// firma Meta) puede usar estos comandos; para cualquier otra persona nada de esto existe ni se menciona. El administrador, además,
// conversa con el agente COMO UN CLIENTE NORMAL: solo estas palabras claras lo activan (todo lo demás devuelve null = flujo de cliente):
//  - "ayuda": lista de comandos. "reporte" / "reporte hoy" / "reporte mes": resumen de indicadores, SOLO cuando lo pide.
//  - "aviso: el viernes 27 cerramos a las 13:00" (o "instrucción: ..."): se muestra y se pide confirmación con "guardar" o "descartar"
//    (palabras que no se usan en una conversación normal) antes de guardarla como AVISO.
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

const GUARDAR = /^(?:guardar|guardalo|guardala)$/;
const DESCARTAR = /^(?:descartar|descartalo|descartala)$/;
const INSTRUCCION = /^(?:aviso|avisar|instrucci[oó]n|anota|anotar)\s*:?\s+([\s\S]+)$/i;
const AYUDA = "Modo administrador de Estudio Levels (solo tu número lo ve):\n\n• *reporte*: resumen de los últimos 7 días (también *reporte hoy* o *reporte mes*)\n• *aviso: el viernes 27 cerramos a las 13:00*: te lo muestro y lo guardo cuando escribas *guardar* (o *descartar*)\n• *avisos*: lista de avisos vigentes\n• *borrar 2*: quita el aviso 2\n\nLos avisos solo informan a los clientes que preguntan por horarios u horas; no bloquean la agenda. Todo lo demás que escribas, el agente lo responde como a un cliente.";

const limpiar = (s: string) => s.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim();

function fechaCorta(f: string, hoy: string) { return textoDeFecha(f, hoy); }

function textoReporte(r: Record<string, number>, titulo: string) {
  const n = (k: string) => r[k] ?? 0;
  return `📊 Reporte ${titulo}\n\n• Respuestas automáticas: ${n("respuestas_automaticas")}\n• Consultas de disponibilidad: ${n("consultas_disponibilidad")}\n• Horas ofrecidas: ${n("ofertas_horas")}\n• Reservas iniciadas por el chat: ${n("reservas_iniciadas")}\n• Reservas cerradas por el chat: ${n("reservas_cerradas")}\n• Derivadas a una persona: ${n("derivadas_persona")}`;
}

/** null = no es un comando de administrador: el mensaje se atiende como el de cualquier cliente. */
export async function manejarAdmin(texto: string, ops: OperacionesAdmin, ahoraMs: number): Promise<string | null> {
  const hoy = ahoraChile(ahoraMs).fecha;
  const t = normalizar(texto).replace(/[!¡¿?.,]+/g, " ").replace(/\s+/g, " ").trim();
  const original = limpiar(texto);

  if (/^(?:ayuda|ayuda admin|admin)$/.test(t)) return AYUDA;

  // ---- reporte (solo cuando lo pide)
  if (/^reporte\b/.test(t)) {
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

  // ---- confirmación de una instrucción pendiente: solo con las palabras "guardar" / "descartar" y solo si hay una pendiente
  if (GUARDAR.test(t) || DESCARTAR.test(t)) {
    const p = await ops.pendiente(ahoraMs);
    if (!p) return null; // sin nada pendiente es una palabra más de la conversación
    if (DESCARTAR.test(t)) { await ops.descartarPendientes(); return "Listo, no guardé nada."; }
    if ((await ops.activos(hoy)).length >= MAX_AVISOS_ACTIVOS) return `Ya hay ${MAX_AVISOS_ACTIVOS} avisos vigentes. Quita alguno con *borrar N* (mira la lista con *avisos*) y vuelve a escribir *guardar*.`;
    await ops.confirmar(p.id);
    return `Guardado ✅ Los clientes que pregunten por horarios u horas verán: «${p.texto}» (hasta ${fechaCorta(p.hasta, hoy)}).\n\nRecuerda que esto solo informa; la agenda de la reserva web no se bloquea.`;
  }

  // ---- una instrucción nueva ("aviso: ..."): se muestra y se pide confirmación
  const m = INSTRUCCION.exec(original);
  if (!m) return null;
  const cuerpo = limpiar(m[1]);
  if (cuerpo.length < 8) return "Escribe el aviso completo, por ejemplo: *aviso: el viernes 27 cerramos a las 13:00*.";
  if (cuerpo.length > MAX_AVISO) return `Es muy largo (máximo ${MAX_AVISO} caracteres). Resúmelo y me lo vuelves a mandar.`;
  const f = interpretarFecha(cuerpo.toLowerCase().normalize("NFD").replace(/([aeiou])[\u0300-\u036f]+/g, "$1").normalize("NFC"), hoy); // conserva la ñ de "mañana"
  const hasta = f !== "invalida" && f.explicita ? f.fecha : sumar(hoy, VIGENCIA_AVISO_DIAS);
  await ops.guardarPendiente(cuerpo, hasta);
  return `Voy a informar esto a los clientes que pregunten por horarios u horas:\n\n«${cuerpo}»\n\nVigente hasta ${fechaCorta(hasta, hoy)}. Escribe *guardar* para dejarlo o *descartar* para cancelarlo.`;
}

/** Solo las consultas de horario / horas / disponibilidad llevan los avisos (no el menú, el curso ni las derivaciones). */
const PIDE_HORARIO = /\b(horario|horarios|abren|abre|abrir|abierto|abiertos|cierran|cierra|cerrado|cerrados|atienden|atiende|atencion|hora|horas|disponib\w*|cupo|cupos|reserv\w*|agend\w*|feriado|feriados)\b/;
export function pideHorario(consulta: string): boolean { return PIDE_HORARIO.test(normalizar(consulta)); }
export function conAvisos(respuesta: string, avisos: string[]): string {
  const a = avisos.map(limpiar).filter(Boolean).slice(0, 3);
  return a.length ? `${respuesta}\n\n📌 ${a.map((x) => `Aviso: ${x}`).join("\n📌 ")}` : respuesta;
}
