// Reglas de las solicitudes de vacaciones. Puro: se prueba sin base de datos (scripts/test-vacaciones-reglas.ts).
//
// - Los dias que cuentan son los LABORALES del profesional (segun su horario): un profesional con el martes libre y el domingo libre
//   gasta 5 dias laborales en una semana, no 7. Por eso dos semanas corridas (14 dias de calendario) pueden ser 10 dias laborales.
// - Las vacaciones SIEMPRE empiezan un lunes y son un solo bloque corrido (sin dias libres intermedios). Para tomar «5 y 5» se piden dos
//   solicitudes, cada una desde un lunes.
// - El derecho se reinicia cada año: el 1 de enero («calendar») o en el aniversario del ingreso («anniversary»).
export type ModoReinicio = "calendar" | "anniversary";
export const DIAS_MAX_POR_ANIO = 30;
export const MAX_DIAS_CORRIDOS = 90; // un bloque no puede durar mas de ~3 meses

const DAY = 86400000;
const ms = (d: string) => Date.parse(`${d}T12:00:00Z`);
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
export const sumarDias = (d: string, n: number) => iso(ms(d) + n * DAY);
export const diaSemana0 = (d: string) => new Date(ms(d)).getUTCDay(); // 0 = domingo ... 6 = sabado
export const esLunes = (d: string) => diaSemana0(d) === 1;
export const esFechaValida = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(ms(v)) && iso(ms(v)) === v;

export interface Periodo { desde: string; hasta: string }

// Aniversario de una fecha de ingreso en un año (29 de febrero -> 28 de febrero si ese año no es bisiesto).
function aniversario(ingreso: string, anio: number): string {
  const [, m, d] = ingreso.split("-").map(Number);
  const ultimo = new Date(Date.UTC(anio, m, 0)).getUTCDate();
  return `${anio}-${String(m).padStart(2, "0")}-${String(Math.min(d, ultimo)).padStart(2, "0")}`;
}

// El periodo de vacaciones (año de derecho) que contiene una fecha.
export function periodoDe(fecha: string, modo: ModoReinicio, ingreso?: string | null): Periodo {
  const anio = Number(fecha.slice(0, 4));
  if (modo === "anniversary" && ingreso && esFechaValida(ingreso)) {
    const este = aniversario(ingreso, anio);
    if (fecha >= este) return { desde: este, hasta: sumarDias(aniversario(ingreso, anio + 1), -1) };
    return { desde: aniversario(ingreso, anio - 1), hasta: sumarDias(este, -1) };
  }
  return { desde: `${anio}-01-01`, hasta: `${anio}-12-31` };
}

// Cuantos dias laborales le corresponden en ese periodo. Quien ya estaba antes del periodo tiene el año completo; quien ingreso durante un
// periodo de 1 de enero parte automaticamente y recibe la parte proporcional (meses completos que le quedan del año).
export function diasDerecho(diasAnio: number, periodo: Periodo, modo: ModoReinicio, ingreso?: string | null): number {
  if (!(diasAnio > 0)) return 0;
  if (modo === "calendar" && ingreso && esFechaValida(ingreso) && ingreso > periodo.desde && ingreso <= periodo.hasta) {
    const m = Number(ingreso.slice(5, 7)), d = Number(ingreso.slice(8, 10));
    const meses = 12 - (m - 1) - (d > 1 ? 1 : 0); // meses completos hasta fin de año
    return Math.floor((diasAnio * Math.max(0, meses)) / 12);
  }
  return diasAnio;
}

// Que dias de la semana trabaja el profesional (indice 0 = domingo). Sin horario cargado se asume lunes a sabado.
export interface FilaHorario { day_of_week: number; is_working: boolean | null }
export function diasQueTrabaja(filas: FilaHorario[] | null | undefined): boolean[] {
  if (!filas || filas.length === 0) return [false, true, true, true, true, true, true];
  const out = [false, false, false, false, false, false, false];
  for (const f of filas) if (Number.isInteger(f.day_of_week) && f.day_of_week >= 0 && f.day_of_week <= 6) out[f.day_of_week] = f.is_working === true;
  return out;
}

// Dias laborales dentro de [desde, hasta] (inclusive).
export function diasLaborales(trabaja: boolean[], desde: string, hasta: string): number {
  if (hasta < desde) return 0;
  let n = 0;
  for (let t = ms(desde); t <= ms(hasta); t += DAY) if (trabaja[new Date(t).getUTCDay()]) n++;
  return n;
}
const interseccion = (a: Periodo, b: Periodo): Periodo | null => { const d = a.desde > b.desde ? a.desde : b.desde, h = a.hasta < b.hasta ? a.hasta : b.hasta; return d <= h ? { desde: d, hasta: h } : null; };

export interface Rango { start_date: string; end_date: string }
// Dias laborales ya tomados o reservados (aprobados + pendientes) dentro de un periodo.
export function diasUsadosEn(trabaja: boolean[], rangos: Rango[], periodo: Periodo): number {
  let n = 0;
  for (const r of rangos) { const x = interseccion({ desde: r.start_date, hasta: r.end_date }, periodo); if (x) n += diasLaborales(trabaja, x.desde, x.hasta); }
  return n;
}

export interface Saldo { periodo: Periodo; derecho: number; usados: number; restantes: number }
export function saldoDe(o: { fecha: string; diasAnio: number; modo: ModoReinicio; ingreso?: string | null; trabaja: boolean[]; rangos: Rango[] }): Saldo {
  const periodo = periodoDe(o.fecha, o.modo, o.ingreso);
  const derecho = diasDerecho(o.diasAnio, periodo, o.modo, o.ingreso);
  const usados = diasUsadosEn(o.trabaja, o.rangos, periodo);
  return { periodo, derecho, usados, restantes: Math.max(0, derecho - usados) };
}

// Cuantos dias a la semana trabaja y cuantos libres tiene (7 - trabaja).
export const diasPorSemana = (trabaja: boolean[]) => trabaja.filter(Boolean).length;
export const NOMBRES_DIA = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
export const diasLibresSemana = (trabaja: boolean[]) => [1, 2, 3, 4, 5, 6, 0].filter((d) => !trabaja[d]).map((d) => NOMBRES_DIA[d]);

// «10 días laborales equivalen a ~2 semanas fuera (14 días corridos)»: las vacaciones se toman en semanas completas desde un lunes y los
// dias libres de cada semana tambien se pasan fuera, pero no se descuentan.
export function equivalencia(laborales: number, trabaja: boolean[]): { semanas: number; corridos: number; porSemana: number } {
  const porSemana = diasPorSemana(trabaja);
  if (laborales <= 0 || porSemana <= 0) return { semanas: 0, corridos: 0, porSemana };
  const semanas = Math.ceil(laborales / porSemana);
  return { semanas, corridos: semanas * 7, porSemana };
}

export type ResultadoSolicitud = { ok: true; laborales: number; corridos: number } | { ok: false; error: string };
// Valida una solicitud: lunes de inicio, bloque corrido, dentro de lo que le queda en cada periodo que toque, sin pisar otras vacaciones.
// `ocupados`: vacaciones ya aprobadas y solicitudes pendientes de ese profesional (sin contar la propia solicitud si se esta re-validando).
export function validarSolicitud(o: { hoy: string; inicio: unknown; fin: unknown; trabaja: boolean[]; diasAnio: number; modo: ModoReinicio; ingreso?: string | null; ocupados: Rango[] }): ResultadoSolicitud {
  if (!esFechaValida(o.inicio) || !esFechaValida(o.fin)) return { ok: false, error: "Elige las fechas en el calendario." };
  const { inicio, fin } = o;
  if (!esLunes(inicio)) return { ok: false, error: "Las vacaciones siempre empiezan un lunes." };
  if (fin < inicio) return { ok: false, error: "La fecha de término no puede ser antes del inicio." };
  if (inicio <= o.hoy) return { ok: false, error: "Elige un lunes futuro." };
  const corridos = Math.round((ms(fin) - ms(inicio)) / DAY) + 1;
  if (corridos > MAX_DIAS_CORRIDOS) return { ok: false, error: `Un bloque de vacaciones no puede superar ${MAX_DIAS_CORRIDOS} días corridos.` };
  const laborales = diasLaborales(o.trabaja, inicio, fin);
  if (laborales < 1) return { ok: false, error: "Ese rango no incluye ningún día en que trabajes." };
  if (o.ocupados.some((r) => r.start_date <= fin && r.end_date >= inicio)) return { ok: false, error: "Esas fechas se cruzan con otras vacaciones o solicitudes tuyas." };
  // Cada periodo (año de derecho) que toca el rango debe alcanzar para los dias laborales que caen en el.
  let desde = inicio;
  for (let guard = 0; guard < 4 && desde <= fin; guard++) {
    const p = periodoDe(desde, o.modo, o.ingreso);
    const tramo = interseccion({ desde: inicio, hasta: fin }, p)!;
    const pedidos = diasLaborales(o.trabaja, tramo.desde, tramo.hasta);
    const s = saldoDe({ fecha: desde, diasAnio: o.diasAnio, modo: o.modo, ingreso: o.ingreso, trabaja: o.trabaja, rangos: o.ocupados });
    if (pedidos > s.restantes) {
      return { ok: false, error: s.derecho === 0 ? "Todavía no tienes días de vacaciones disponibles en ese periodo." : `Te quedan ${s.restantes} día(s) laborales en ese periodo (de ${s.derecho}) y esta solicitud usa ${pedidos}.` };
    }
    desde = sumarDias(p.hasta, 1);
  }
  return { ok: true, laborales, corridos };
}
