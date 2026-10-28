import { norm } from "./texto";
import type { MiembroEquipo } from "./bloqueo";

// Preguntas sobre cifras del negocio: «cuanto hizo Pablo esta semana», «cuanto recibimos en credito», «quien es el barbero que mas corta».
// Solo ENTIENDE la frase y la convierte en una consulta estructurada. Los permisos y el negocio los valida SIEMPRE el servidor (/api/oti/consulta);
// aqui nunca se decide quien puede ver cifras.
export type Metrica = "dinero" | "servicios" | "ranking";
export type Medio = "credit_card" | "debit_card" | "cash" | "transfer";
export interface ConsultaOti { metrica: Metrica; desde: string; hasta: string; etiqueta: string; barberId?: string; barberNombre?: string; medio?: Medio }
export type PedidoConsulta =
  | { ok: true; consulta: ConsultaOti }
  | { ok: false; falta: "periodo" | "ambiguo"; candidatos?: MiembroEquipo[] };

export const NOMBRE_MEDIO: Record<Medio, string> = { credit_card: "tarjeta de crédito", debit_card: "tarjeta de débito", cash: "efectivo", transfer: "transferencia" };
const DAY = 86400000;
const ms = (iso: string) => { const [y, m, d] = iso.split("-").map(Number); return Date.UTC(y, m - 1, d); };
const iso = (t: number) => { const d = new Date(t); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`; };

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const fechaCorta = (s: string) => `${Number(s.slice(8, 10))} de ${MESES[Number(s.slice(5, 7)) - 1]}`;

// Semana = lunes a domingo. «Esta semana» llega hasta hoy.
function periodo(t: string, hoy: string): { desde: string; hasta: string; etiqueta: string } | null {
  const wd = (new Date(ms(hoy)).getUTCDay() + 6) % 7; // 0 = lunes
  const lunes = iso(ms(hoy) - wd * DAY);
  if (/\bsemana pasada\b|\bultima semana\b/.test(t)) { const d = iso(ms(lunes) - 7 * DAY); return { desde: d, hasta: iso(ms(d) + 6 * DAY), etiqueta: `la semana pasada (${fechaCorta(d)} al ${fechaCorta(iso(ms(d) + 6 * DAY))})` }; }
  if (/\b(esta|la) semana\b/.test(t)) return { desde: lunes, hasta: hoy, etiqueta: `esta semana (${fechaCorta(lunes)} a hoy)` };
  const [y, m] = hoy.split("-").map(Number);
  if (/\bmes pasado\b|\bultimo mes\b/.test(t)) {
    const ini = new Date(Date.UTC(y, m - 2, 1)), fin = new Date(Date.UTC(y, m - 1, 0));
    return { desde: iso(+ini), hasta: iso(+fin), etiqueta: `el mes pasado (${MESES[ini.getUTCMonth()]})` };
  }
  if (/\b(este|el) mes\b/.test(t)) return { desde: `${y}-${String(m).padStart(2, "0")}-01`, hasta: hoy, etiqueta: `este mes (${MESES[m - 1]}, hasta hoy)` };
  if (/\bayer\b/.test(t)) { const d = iso(ms(hoy) - DAY); return { desde: d, hasta: d, etiqueta: `ayer (${fechaCorta(d)})` }; }
  if (/\bhoy\b/.test(t)) return { desde: hoy, hasta: hoy, etiqueta: "hoy" };
  return null;
}

const DINERO = /\b(dinero|plata|vendi\w*|vendio|hizo|hicimos|hice|recibi\w*|ingres\w*|factur\w*|gener\w*|gan\w*|entro|entraron|ventas)\b/;
const RANKING = /\b(quien|cual|que (?:barbero|profesional|peluquero|estilista))\b.*\bmas\b|\bel (?:barbero|profesional)\b.*\bque mas\b|\bque mas (?:corta|vende|atiende|trabaja|factura|hace)\b/;

// null = no es una consulta de cifras (va a ayuda u otras reglas).
export function entenderConsulta(texto: string, hoy: string, equipo: MiembroEquipo[]): PedidoConsulta | null {
  const t = norm(texto);
  let metrica: Metrica | null = null;
  if (RANKING.test(t)) metrica = "ranking";
  else if (/\b(cuanto|cuanta)s?\b/.test(t) && /\b(servicios?|cortes?|atenciones|clientes atendidos)\b/.test(t)) metrica = "servicios";
  else if (/\b(cuanto|cuanta)\b/.test(t) && DINERO.test(t)) metrica = "dinero";
  if (!metrica) return null;

  const p = periodo(t, hoy);
  if (!p) return { ok: false, falta: "periodo" };

  let barber: MiembroEquipo | undefined;
  if (metrica !== "ranking") {
    const hallados = equipo.filter((m) => {
      const n = norm(m.name);
      if (!n) return false;
      if (` ${t} `.includes(` ${n} `)) return true;
      const primero = n.split(" ")[0];
      return primero.length >= 3 && new RegExp(`\\b${primero}\\b`).test(t);
    });
    if (hallados.length > 1) return { ok: false, falta: "ambiguo", candidatos: hallados };
    barber = hallados[0];
  }
  let medio: Medio | undefined;
  if (/\bcredito\b/.test(t)) medio = "credit_card";
  else if (/\bdebito\b/.test(t)) medio = "debit_card";
  else if (/\befectivo\b/.test(t)) medio = "cash";
  else if (/\btransferencia\w*\b/.test(t)) medio = "transfer";
  if (metrica === "ranking") medio = undefined;
  return { ok: true, consulta: { metrica, ...p, barberId: barber?.id, barberNombre: barber?.name, medio } };
}
