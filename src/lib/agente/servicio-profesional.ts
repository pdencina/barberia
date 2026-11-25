// Quién hace qué servicio. Responde con los datos REALES de la agenda (Profesionales > Servicios), sin IA:
// "¿quién hace rizos?", "¿Enzo hace rizos?", "quiero reservar rizos con Enzo". Si no aplica, devuelve null y sigue el flujo de siempre.
import type { DatosFaq } from "./faq-fija";

/** Por profesional: ids de servicio que ofrece; null = ofrece todos (no marcó ninguno, igual que en Profesionales > Servicios). */
export type ServiciosPorProfesional = Record<string, string[] | null>;

const sin = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
// Mismo sonido: "risos" = "rizos", "bisos" = "visos".
export const sonido = (s: string) => sin(s).replace(/z/g, "s").replace(/c(?=[ei])/g, "s").replace(/v/g, "b").replace(/qu(?=[ei])/g, "k");
export const palabras = (s: string) => sonido(s).split(/[^a-zñ0-9]+/).filter(Boolean);
const COMUNES = new Set(["corte", "cortes", "barba", "cabello", "pelo", "simple", "lavado", "diseno", "solo", "arreglo", "ritual", "panos", "calientes", "cejas", "tijeras", "servicio", "con", "para", "del", "los", "las", "una", "uno"]);

function tokensDe(nombre: string, ajenos: Set<string>): string[] {
  return palabras(nombre).filter((w) => w.length >= 4 && !COMUNES.has(w) && !ajenos.has(w));
}
const calza = (a: string, b: string) => a === b || (Math.min(a.length, b.length) >= 4 && (a.startsWith(b) || b.startsWith(a)));

export function responderServicioProfesional(texto: string, datos: DatosFaq | null, mapa: ServiciosPorProfesional): string | null {
  if (!datos || typeof texto !== "string" || texto.length > 300) return null;
  const pros = (datos.profesionales ?? []).filter((p) => p.id);
  const servicios = (datos.servicios ?? []).filter((s) => s.id);
  if (pros.length === 0 || servicios.length === 0) return null;
  const ajenos = new Set(pros.flatMap((p) => palabras(p.nombre)));
  const msg = palabras(texto);
  // Servicio nombrado: el que comparte alguna palabra propia de su nombre ("rizos", "ondulación", "visos", "color").
  const hallados = servicios.filter((s) => tokensDe(s.nombre, ajenos).some((t) => msg.some((m) => calza(m, t))));
  if (hallados.length === 0) return null;
  // Si nombró varios servicios distintos no se adivina.
  const claves = new Set(hallados.map((s) => tokensDe(s.nombre, ajenos).sort().join("|")));
  if (claves.size > 3) return null;
  // Varios servicios con la misma palabra ("Permanente de rizos" y "Rizos/Ondulación permanentes"): lo hace quien haga cualquiera de ellos.
  const hacenAlguno = (p: (typeof pros)[number]) => { const l = mapa[p.id as string]; return l === undefined ? false : l === null ? true : hallados.some((h) => l.includes(h.id as string)); };
  const s = hallados.find((h) => pros.some((p) => { const l = mapa[p.id as string]; return Array.isArray(l) && l.includes(h.id as string); })) ?? hallados[0];
  const hacen = hacenAlguno;
  const quienes = pros.filter(hacen);
  const t = sin(texto);
  const nombrados = pros.filter((p) => { const ws = palabras(p.nombre).filter((w) => w.length >= 3); return ws.some((w) => msg.some((m) => m === w)); });
  const lista = (ps: typeof pros) => ps.map((p) => `• *${p.nombre}*`).join("\n");
  const servicio = `*${s.nombre}*`;
  const quien = /\b(quien|quienes|que profesional|que barbero|cual(?:es)? (?:profesional|barbero)|con quien|quien lo|quien la)\b/.test(t);
  const hace = /\b(hace|hacen|hacer|hago|atiende|atienden|realiza|realizan|ofrece|ofrecen|trabaja|trabajan|puede|pueden|hacerme|hacerse)\b/.test(t);
  const reserva = /\b(reserv|agend|hora|cita|pedir)/.test(t);
  if (quienes.length === 0) {
    if (quien || (nombrados.length > 0 && hace)) return `Por ahora no tengo ningún profesional configurado para ${servicio}. Escríbenos y te ayudamos directamente.`;
    return null;
  }
  const nombresOk = quienes.map((p) => p.nombre.split(" ").slice(0, 2).join(" "));
  if (nombrados.length > 0 && (hace || reserva)) {
    const noHacen = nombrados.filter((p) => !hacen(p));
    if (noHacen.length > 0) {
      const quien1 = noHacen.map((p) => `*${p.nombre}*`).join(" y ");
      return `${quien1} no ${noHacen.length > 1 ? "hacen" : "hace"} ${servicio}.\n\n${quienes.length === 1 ? "Lo hace" : "Lo hacen"}:\n${lista(quienes)}\n\n¿Con quién te gustaría${reserva ? " agendar" : ""}? Dime el nombre y te muestro sus horas.`;
    }
    if (nombrados.every(hacen) && hace && !reserva) return `Sí, *${nombrados.map((p) => p.nombre).join("* y *")}* ${nombrados.length > 1 ? "hacen" : "hace"} ${servicio}.`;
    return null; // quiere reservarlo con alguien que sí lo hace: sigue el flujo normal
  }
  if (quien || (hace && /\b(se hace|hacen|hace)\b/.test(t))) {
    return `${servicio} ${quienes.length === 1 ? "lo hace" : "lo hacen"}:\n${lista(quienes)}${quienes.length === pros.length ? "" : `\n\n${quienes.length === 1 ? "Los demás profesionales no lo hacen" : "Los demás no lo hacen"}.`}\n\n¿Con quién te gustaría agendar? Dime el nombre${nombresOk.length ? ` (por ejemplo ${nombresOk[0]})` : ""} y te muestro sus horas.`;
  }
  return null;
}

/** Servicio que el cliente nombra ("rizos", "visos", "color"): el catálogo real, con su duración. Si varios comparten la palabra, el que alguien hace. null si no nombra ninguno. */
export function servicioPedido(texto: string, datos: DatosFaq | null): { id: string; nombre: string; duracionMin: number } | null {
  if (!datos || typeof texto !== "string" || texto.length > 300) return null;
  const pros = (datos.profesionales ?? []).filter((p) => p.id);
  const ajenos = new Set(pros.flatMap((p) => palabras(p.nombre)));
  const msg = palabras(texto);
  const hallados = (datos.servicios ?? []).filter((s) => s.id && typeof s.duracionMin === "number" && tokensDe(s.nombre, ajenos).some((t) => msg.some((m) => calza(m, t))));
  const conAlguien = hallados.filter((h) => pros.some((p) => !Array.isArray(p.serviciosIds) || p.serviciosIds.includes(h.id as string)));
  const s = conAlguien[0];
  return s ? { id: s.id as string, nombre: s.nombre.trim(), duracionMin: s.duracionMin as number } : null;
}

/** "*Rizos/Ondulación permanentes* (3 horas) lo hacen: Javier, Gabriel y Dylan." — para anteponer a las horas disponibles. */
export function introServicio(sv: { id: string; nombre: string; duracionMin: number }, datos: DatosFaq | null): string | null {
  const quienes = (datos?.profesionales ?? []).filter((p) => p.id && (!Array.isArray(p.serviciosIds) || p.serviciosIds.includes(sv.id))).map((p) => p.nombre.trim().split(" ").slice(0, 2).join(" "));
  if (quienes.length === 0) return null;
  const m = sv.duracionMin, dur = m >= 60 ? `${Math.floor(m / 60)} ${Math.floor(m / 60) === 1 ? "hora" : "horas"}${m % 60 ? ` y ${m % 60} min` : ""}` : `${m} min`;
  const lista = quienes.length <= 1 ? quienes.join("") : `${quienes.slice(0, -1).join(", ")} y ${quienes[quienes.length - 1]}`;
  return `*${sv.nombre.trim()}* (${dur}) ${quienes.length === 1 ? "lo hace" : "lo hacen"} ${lista}.`;
}
