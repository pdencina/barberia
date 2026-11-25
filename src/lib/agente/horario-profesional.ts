// Horario de trabajo de un profesional (Profesionales > Horario), respondido con los datos reales de la agenda, sin IA:
// "¿Nicolás atiende en las mañanas?", "¿qué días trabaja Pablo?", "¿hasta qué hora atiende Enzo?". Si no aplica, null y sigue el flujo de siempre.
import type { DatosFaq } from "./faq-fija";

export interface TramoDia { dia: number; trabaja: boolean; desde: string; hasta: string }
export interface Vacacion { desde: string; hasta: string }
export interface HorariosProfesionales { semana: Record<string, TramoDia[]>; vacaciones: Record<string, Vacacion[]> }
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const fechaLinda = (f: string) => `${Number(f.slice(8, 10))} de ${MESES[Number(f.slice(5, 7)) - 1]}`;

const sin = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const PLURAL = ["domingos", "lunes", "martes", "miércoles", "jueves", "viernes", "sábados"];
const CLAVE: Record<string, number> = { domingo: 0, domingos: 0, lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6, sabados: 6 };
const mins = (h: string) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5));
const hh = (h: string) => h.slice(0, 5);
const FRANJAS: Record<string, [number, number, string]> = { manana: [0, 12 * 60, "en la mañana"], tarde: [12 * 60, 20 * 60, "en la tarde"], noche: [20 * 60, 24 * 60, "en la noche"] };

/** "lunes a viernes 07:00 a 10:00 · sábado 07:00 a 09:00": agrupa días contiguos con el mismo horario. */
export function resumenSemana(tr: TramoDia[]): string {
  const por = new Map<number, TramoDia>(); for (const t of tr) if (t.trabaja) por.set(t.dia, t);
  const orden = [1, 2, 3, 4, 5, 6, 0].filter((d) => por.has(d));
  const grupos: { dias: number[]; desde: string; hasta: string }[] = [];
  for (const d of orden) {
    const t = por.get(d)!, g = grupos[grupos.length - 1];
    const sig = g && g.desde === hh(t.desde) && g.hasta === hh(t.hasta) && (g.dias[g.dias.length - 1] + 1) % 7 === d;
    if (sig) g.dias.push(d); else grupos.push({ dias: [d], desde: hh(t.desde), hasta: hh(t.hasta) });
  }
  return grupos.map((g) => `${g.dias.length === 1 ? DIAS[g.dias[0]] : g.dias.length === 2 ? `${DIAS[g.dias[0]]} y ${DIAS[g.dias[1]]}` : `${DIAS[g.dias[0]]} a ${DIAS[g.dias[g.dias.length - 1]]}`} de ${g.desde} a ${g.hasta}`).join("\n• ");
}

export function responderHorarioProfesional(texto: string, datos: DatosFaq | null, info: HorariosProfesionales, hoy: string, proxima?: (proId: string) => string | null): string | null {
  const horarios = info.semana;
  if (!datos || typeof texto !== "string" || texto.length > 200) return null;
  const t = sin(texto).replace(/[¿?¡!.,]/g, " ").replace(/\s+/g, " ").trim();
  const palabras = t.split(" ");
  const pros = (datos.profesionales ?? []).filter((p) => p.id);
  const nombrados = pros.filter((p) => sin(p.nombre).split(/\s+/).filter((w) => w.length >= 3).some((w) => palabras.includes(w)));
  if (nombrados.length !== 1) return null; // ninguno o ambiguo: no se adivina
  const horaDeDia = /\b(a que hora|hasta que hora|desde que hora|que horarios?|horarios?|turno|que dias|dias trabaja|dias atiende|cuando atiende|cuando trabaja|fines? de semana)\b/.test(t);
  const verbo = /\b(atiende|atienden|trabaja|trabajan|corta|cortan|cortando|viene|vienen|esta|estan|llega|entra|sale|cierra|abre)\b/.test(t);
  const franja = /\b(?:en|por|de) la (manana|tarde|noche)s?\b|\b(mananas|tardes|noches)\b/.exec(t);
  const diaN = palabras.map((w) => CLAVE[w]).find((d) => d !== undefined);
  const libres = /\b(dias? libres?|dia libre|libra|libran|descansa|descansan|dias? de descanso|no trabaja|no atiende|vacaciones|de vacaciones)\b/.test(t);
  if (libres) {
    const p = nombrados[0], tr = horarios[p.id as string];
    if (!tr || tr.length === 0) return null;
    const nombre = `*${p.nombre}*`;
    const dias = [1, 2, 3, 4, 5, 6, 0].filter((d) => !tr.some((x) => x.dia === d && x.trabaja));
    const vac = (info.vacaciones[p.id as string] ?? []).filter((v) => v.hasta >= hoy).sort((a, b) => a.desde.localeCompare(b.desde)).slice(0, 3);
    const partes = [dias.length === 0 ? `${nombre} trabaja todos los días de la semana.` : `${nombre} no trabaja los ${dias.map((d) => PLURAL[d]).join(", ").replace(/, ([^,]*)$/, " y $1")}.`];
    partes.push(vac.length ? `Vacaciones próximas:\n${vac.map((v) => `• del ${fechaLinda(v.desde)} al ${fechaLinda(v.hasta)}`).join("\n")}` : "No tiene vacaciones agendadas.");
    const cola = proxima?.(p.id as string); if (cola) partes.push(cola);
    return partes.join("\n\n");
  }
  // Una consulta de horas libres concretas ("tiene hora el sábado", "a las 5") es de disponibilidad, no de horario.
  if (/\b(hora|horas|cupo|cupos|disponible|disponibles|agendar|agendame|reservar|reserva)\b/.test(t) && !/\b(a que hora|hasta que hora|desde que hora)\b/.test(t)) return null;
  if (!horaDeDia && !(verbo && (franja || diaN !== undefined))) return null;
  const p = nombrados[0], tr = horarios[p.id as string];
  if (!tr || tr.length === 0) return null;
  const trabaja = tr.filter((x) => x.trabaja);
  const nombre = `*${p.nombre}*`;
  if (trabaja.length === 0) return `${nombre} no tiene días de trabajo configurados por ahora.`;
  const semana = `• ${resumenSemana(tr)}`;
  const cola = proxima?.(p.id as string);
  const colaTxt = cola ? `\n\n${cola}` : "";
  if (diaN !== undefined) {
    const d = tr.find((x) => x.dia === diaN && x.trabaja);
    const dia = DIAS[diaN];
    return d ? `Sí, ${nombre} atiende los ${dia === "sábado" || dia === "domingo" ? dia + "s" : dia + "s"} de ${hh(d.desde)} a ${hh(d.hasta)}.\n\nSu horario completo:\n${semana}${colaTxt}` : `${nombre} no atiende los ${dia}s.\n\nSu horario:\n${semana}${colaTxt}`;
  }
  if (franja) {
    const k = (franja[1] ?? (franja[2] === "mananas" ? "manana" : franja[2] === "tardes" ? "tarde" : "noche")) as keyof typeof FRANJAS;
    const [a, b, txt] = FRANJAS[k];
    const dias = trabaja.filter((x) => mins(x.desde) < b && mins(x.hasta) > a);
    if (dias.length === 0) return `No, ${nombre} no atiende ${txt}.\n\nSu horario:\n${semana}${colaTxt}`;
    const parcial = dias.length < trabaja.length;
    return `Sí, ${nombre} atiende ${txt}${parcial ? " algunos días" : ""}.\n\nSu horario:\n${semana}${colaTxt}`;
  }
  return `El horario de ${nombre}:\n${semana}${colaTxt}`;
}
