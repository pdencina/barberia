import { norm } from "./texto";
import type { MiembroEquipo } from "./bloqueo";

// Preguntas sobre cifras del negocio: «cuanto hizo Pablo esta semana», «cuanto recibimos en credito», «quien es el barbero que mas corta».
// Solo ENTIENDE la frase y la convierte en una consulta estructurada. Los permisos y el negocio los valida SIEMPRE el servidor (/api/oti/consulta);
// aqui nunca se decide quien puede ver cifras.
export type Metrica = "dinero" | "servicios" | "ranking" | "promedio_dia" | "dias" | "consejos";
export type Medio = "credit_card" | "debit_card" | "cash" | "transfer";
export interface ConsultaOti { metrica: Metrica; desde: string; hasta: string; etiqueta: string; barberId?: string; barberNombre?: string; medio?: Medio; diaSemana?: number; orden?: "lento" | "fuerte" }
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
export function periodo(t: string, hoy: string): { desde: string; hasta: string; etiqueta: string } | null {
  const wd = (new Date(ms(hoy)).getUTCDay() + 6) % 7; // 0 = lunes
  const lunes = iso(ms(hoy) - wd * DAY);
  if (/\bsemana pasada\b|\bultima semana\b/.test(t)) { const d = iso(ms(lunes) - 7 * DAY); return { desde: d, hasta: iso(ms(d) + 6 * DAY), etiqueta: `la semana pasada (${fechaCorta(d)} al ${fechaCorta(iso(ms(d) + 6 * DAY))})` }; }
  if (/\b(esta|la) semana\b/.test(t)) return { desde: lunes, hasta: hoy, etiqueta: `esta semana (${fechaCorta(lunes)} a hoy)` };
  const [y, m] = hoy.split("-").map(Number);
  if (/\banteayer\b|\bantes de ayer\b/.test(t)) { const d = iso(ms(hoy) - 2 * DAY); return { desde: d, hasta: d, etiqueta: `anteayer (${fechaCorta(d)})` }; }
  const mUlt = t.match(/\bultim[oa]s (\d{1,3}) (dias|semanas|meses)\b/);
  if (mUlt) {
    const n = Math.min(Number(mUlt[1]), mUlt[2] === "dias" ? 365 : mUlt[2] === "semanas" ? 52 : 12);
    const dias = mUlt[2] === "dias" ? n : mUlt[2] === "semanas" ? n * 7 : n * 30;
    return { desde: iso(ms(hoy) - (dias - 1) * DAY), hasta: hoy, etiqueta: `los ultimos ${n} ${mUlt[2]}` };
  }
  if (/\b(este|el) ano\b/.test(t)) return { desde: `${y}-01-01`, hasta: hoy, etiqueta: `este año (${y}, hasta hoy)` };
  const mes = MESES.findIndex((nm) => new RegExp(`\\b${nm}\\b`).test(t));
  if (mes >= 0 && !/\b(este|el) mes\b/.test(t)) {
    const yy = mes + 1 > m ? y - 1 : y; // un mes futuro se entiende del año pasado
    const ini = new Date(Date.UTC(yy, mes, 1)), fin = new Date(Date.UTC(yy, mes + 1, 0));
    const hastaMes = iso(+fin) > hoy ? hoy : iso(+fin);
    return { desde: iso(+ini), hasta: hastaMes, etiqueta: `${MESES[mes]} de ${yy}` };
  }
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

const DIAS_SEMANA: Record<string, number> = { lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6, sabados: 6, domingo: 7, domingos: 7, lunes_: 1 };
const diaSemanaDe = (t: string): number | undefined => {
  const m = t.match(/\b(lunes|martes|miercoles|jueves|viernes|sabados?|domingos?)\b/);
  return m ? DIAS_SEMANA[m[1]] : undefined;
};
export const NOMBRE_DIA = ["", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];
const MEDIO_PALABRA = /\b(efectivo|credito|debito|transferencias?|tarjetas?|caja)\b/;
const CONSEJOS = /\bvend(er|o|a|amos|an) mas\b|\bganar mas\b|\bgano mas\b|\bsub(ir|o|a|imos) (las |mis )?(ventas|ingresos)\b|\baument(ar|o|a|amos) (las |mis )?(ventas|ingresos|clientes|reservas)\b|\bcrec(er|e|emos)\b|\bmejorar (las |mis )?(ventas|ingresos)\b|\bconsejos?\b|\brecomendaci\w+\b|\bque hago para\b.*\b(mas|vender|crecer)\b|\bcomo (le )?(va|esta) (mi|el) negocio\b|\bdiagnostico\b|\bestrategi\w+\b/;
const DIA_LENTO = /\bdia\b.*\b(mas )?(lento|flojo|tranquilo|malo|bajo|debil|peor)\b|\b(peor|mas flojo|mas lento) dia\b|\bdia que (menos|peor)\b/;
const DIA_FUERTE = /\bdia\b.*\b(mas fuerte|mejor|mas alto)\b|\bmejor dia\b|\bdia que mas (vendi|vendimos|se vendio|vende|facture)\b/;

// null = no es una consulta de cifras (va a ayuda u otras reglas).
export function entenderConsulta(texto: string, hoy: string, equipo: MiembroEquipo[]): PedidoConsulta | null {
  const t = norm(texto);
  let metrica: Metrica | null = null;
  let orden: "lento" | "fuerte" | undefined;
  const diaSemana = diaSemanaDe(t);
  if (CONSEJOS.test(t)) metrica = "consejos";
  else if (DIA_LENTO.test(t)) { metrica = "dias"; orden = "lento"; }
  else if (DIA_FUERTE.test(t)) { metrica = "dias"; orden = "fuerte"; }
  else if (/\bpromedio\b/.test(t)) metrica = "promedio_dia";
  else if (RANKING.test(t)) metrica = "ranking";
  else if (/\b(cuanto|cuanta)s?\b/.test(t) && /\b(servicios?|cortes?|atenciones|clientes atendidos)\b/.test(t)) metrica = "servicios";
  else if (/\b(cuanto|cuanta)s?\b/.test(t) && (DINERO.test(t) || MEDIO_PALABRA.test(t) || /\bllev(amos|o|an)\b/.test(t))) metrica = "dinero";
  else if (/\b(ventas|ingresos|facturacion)\b/.test(t) && periodo(t, hoy)) metrica = "dinero";
  if (!metrica) return null;

  // Sin periodo: algunas preguntas tienen uno por defecto; las demas lo piden.
  let p = periodo(t, hoy);
  if (!p && metrica === "promedio_dia") p = { desde: iso(ms(hoy) - 55 * DAY), hasta: hoy, etiqueta: "las ultimas 8 semanas" };
  if (!p && metrica === "dias") { const [y, m] = hoy.split("-").map(Number); p = { desde: `${y}-${String(m).padStart(2, "0")}-01`, hasta: hoy, etiqueta: `este mes (${MESES[m - 1]}, hasta hoy)` }; }
  if (!p && metrica === "consejos") p = { desde: iso(ms(hoy) - 119 * DAY), hasta: hoy, etiqueta: "los ultimos 4 meses" };
  if (!p) return { ok: false, falta: "periodo" };

  let barber: MiembroEquipo | undefined;
  if (metrica === "dinero" || metrica === "servicios" || metrica === "promedio_dia") {
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
  if (metrica === "ranking" || metrica === "dias" || metrica === "consejos") medio = undefined;
  return { ok: true, consulta: { metrica, ...p, barberId: barber?.id, barberNombre: barber?.name, medio, diaSemana: metrica === "promedio_dia" ? diaSemana : undefined, orden } };
}
