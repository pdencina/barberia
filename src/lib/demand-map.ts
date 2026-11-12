// Mapa de demanda: reservas promedio por semana en cada dia y hora. Puro: se prueba sin base de datos.
// Las citas guardan la hora de Chile escrita como UTC, por eso la hora se lee del texto, sin convertir zonas.
//
// Se mide el TIEMPO OCUPADO, no solo cuántas citas empiezan en cada hora: una cita larga (por ejemplo 3 horas) ocupa a su profesional
// en todas las horas que dura. Antes solo contaba la hora de inicio, y para un negocio de servicios largos las horas siguientes
// (10 y 11 si empieza a las 9) salían como «poca demanda» cuando en realidad estaban ocupadas. El tiempo ocupado se expresa en
// «reservas equivalentes» (dividido por la duración típica de las citas del negocio) para que los números sigan siendo comparables.
export interface DemandRow { date: string; start_time: string; status: string; end_time?: string | null }
// disp / ocupado: horas por semana en que el equipo está disponible y ocupado en esa hora (solo si se conocen los horarios del negocio).
export interface DemandCell { dow: number; hour: number; total: number; avg: number; disp?: number; ocupado?: number }
export interface DemandMap {
  weeks: number; desde: string; hasta: string; totalReservas: number;
  cells: DemandCell[];                              // solo celdas con reservas
  porDia: { dow: number; total: number; avg: number }[]; // dow 1 = lunes ... 7 = domingo
  horas: number[];                                  // horas a mostrar (rango con actividad)
  // Horas en que el negocio SÍ atiende cada día («dow-hora»): según los horarios del equipo (fuente «horarios») o, si no hay horarios
  // cargados, según cuándo hay reservas (fuente «reservas»). Fuera de ahí no se pinta ni se cuenta como demanda baja.
  abiertas: string[];
  fuente: "horarios" | "reservas";
  // «bloques»: negocios con servicios largos (2-3 horas), donde medir por hora no sirve. Cada fila es un BLOQUE DE TRABAJO (la hora en que
  // empiezan sus servicios y lo que duran) y «hour» de cada celda es la hora de inicio del bloque. Sin este campo (o «horas») es el mapa de siempre.
  modo?: "horas" | "bloques";
  bloques?: Bloque[];
}
export interface Bloque { hour: number; inicio: number; fin: number; etiqueta: string }
export const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const CUENTAN = new Set(["completed", "confirmed", "scheduled", "in_progress", "no_show"]); // todo menos canceladas

// Los umbrales (día "casi cerrado", hora o celda "con actividad") se pensaron para un negocio grande (~60 reservas por semana o más).
// En uno chico (ej. 1 profesional con 9 reservas por semana) todo quedaba bajo el umbral: todos los días salían "cerrados" y todo en 0.
// Por eso los umbrales se achican en proporción al volumen del negocio (nunca se agrandan): negocio de 60+/semana = igual que antes.
export function escalaNegocio(totalReservas: number, weeks: number): number {
  const porSemana = weeks > 0 ? totalReservas / weeks : 0;
  return Math.min(1, Math.max(0.05, porSemana / 60));
}
export const esDiaCerrado = (avg: number, escala: number) => avg < Math.max(0.25, 5 * escala);

export function diaSemana(fecha: string): number { // 1 = lunes ... 7 = domingo
  const [y, m, d] = fecha.split("-").map(Number);
  const w = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return w === 0 ? 7 : w;
}
export function horaDe(startTime: string): number | null {
  const m = /[T ](\d{2}):\d{2}/.exec(startTime || "");
  return m ? Number(m[1]) : null;
}
const minutoDe = (t: string | null | undefined): number | null => {
  const m = /[T ](\d{2}):(\d{2})/.exec(t || "");
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};
// Minutos de la cita que caen en cada hora del día. Sin hora de término válida se asume 1 hora (como antes, solo cuenta la hora de inicio).
export function minutosPorHora(startTime: string, endTime?: string | null): Map<number, number> {
  const ini = minutoDe(startTime);
  const out = new Map<number, number>();
  if (ini === null) return out;
  let fin = minutoDe(endTime);
  if (fin === null || fin <= ini || fin - ini > 12 * 60) fin = ini + 60;
  fin = Math.min(fin, 24 * 60);
  for (let h = Math.floor(ini / 60); h * 60 < fin; h++) {
    const m = Math.min(fin, (h + 1) * 60) - Math.max(ini, h * 60);
    if (m > 0) out.set(h, m);
  }
  return out;
}

const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
const mediana = (a: number[]) => { const o = [...a].sort((x, y) => x - y); return o.length ? (o.length % 2 ? o[(o.length - 1) / 2] : (o[o.length / 2 - 1] + o[o.length / 2]) / 2) : 0; };
export const DURACION_BLOQUES = 90; // si la cita típica dura 90 min o más, el negocio trabaja por bloques

// Detecta los bloques de trabajo de un negocio de servicios largos: los horarios de inicio que de verdad se usan (redondeados a 30 min) y lo que dura
// una cita que empieza ahí. Devuelve null si el negocio no es de servicios largos (se usa el mapa por horas de siempre).
export function detectarBloques(rows: DemandRow[], desde: string, hasta: string): Bloque[] | null {
  const citas: { ini: number; dur: number }[] = [];
  for (const r of rows) {
    if (!CUENTAN.has(r.status) || !r.date || r.date < desde || r.date > hasta) continue;
    const ini = minutoDe(r.start_time), fin = minutoDe(r.end_time);
    if (ini === null || fin === null || fin <= ini || fin - ini > 12 * 60) continue;
    citas.push({ ini, dur: fin - ini });
  }
  if (citas.length < 6 || mediana(citas.map((c) => c.dur)) < DURACION_BLOQUES) return null;
  const redondeo = (m: number) => Math.round(m / 30) * 30;
  const cuenta = new Map<number, number>();
  for (const c of citas) cuenta.set(redondeo(c.ini), (cuenta.get(redondeo(c.ini)) || 0) + 1);
  const minimo = Math.max(3, Math.round(citas.length * 0.04));
  // Los inicios que se repiten, del más usado al menos; uno a menos de 90 min de otro ya elegido se considera el mismo bloque.
  const inicios: number[] = [];
  for (const [m] of Array.from(cuenta.entries()).filter(([, n]) => n >= minimo).sort((a, b) => b[1] - a[1])) if (!inicios.some((x) => Math.abs(x - m) < DURACION_BLOQUES)) inicios.push(m);
  if (!inicios.length) return null;
  inicios.sort((a, b) => a - b);
  const bloques: Bloque[] = inicios.map((inicio) => {
    const propias = citas.filter((c) => bloqueMasCercano(inicios, c.ini) === inicio).map((c) => c.dur);
    const fin = inicio + Math.max(30, Math.round(mediana(propias) / 30) * 30);
    return { hour: Math.floor(inicio / 60), inicio, fin, etiqueta: `${hhmm(inicio)}–${hhmm(fin)}` };
  });
  // Dos bloques no pueden caer en la misma hora (la hora es la clave de la fila).
  return bloques.filter((b, i) => bloques.findIndex((x) => x.hour === b.hour) === i);
}
function bloqueMasCercano(inicios: number[], ini: number): number | null {
  let mejor: number | null = null, d = Infinity;
  for (const x of inicios) { const dd = Math.abs(x - ini); if (dd < d) { d = dd; mejor = x; } }
  return d <= DURACION_BLOQUES ? mejor : null;
}

function construirMapaBloques(rows: DemandRow[], weeks: number, desde: string, hasta: string, bloques: Bloque[], disponibilidad?: Record<string, number>): DemandMap {
  const inicios = bloques.map((b) => b.inicio);
  const cuenta = new Map<string, number>(); // «dow-horaBloque» -> reservas en el período
  const porDow = new Map<number, number>();
  let total = 0;
  for (const r of rows) {
    if (!CUENTAN.has(r.status) || !r.date || r.date < desde || r.date > hasta) continue;
    const ini = minutoDe(r.start_time); if (ini === null) continue;
    const b = bloqueMasCercano(inicios, ini); if (b === null) continue; // cita suelta fuera de los bloques de trabajo
    const dow = diaSemana(r.date), hour = Math.floor(b / 60);
    cuenta.set(`${dow}-${hour}`, (cuenta.get(`${dow}-${hour}`) || 0) + 1);
    porDow.set(dow, (porDow.get(dow) || 0) + 1);
    total++;
  }
  const conHorarios = !!disponibilidad && Object.values(disponibilidad).some((v) => v > 0);
  const cells: DemandCell[] = [];
  const abiertas: string[] = [];
  for (let dow = 1; dow <= 7; dow++) for (const b of bloques) {
    const n = cuenta.get(`${dow}-${b.hour}`) || 0;
    // Un bloque está abierto ese día si hubo reservas en él o, con horarios cargados, si el equipo trabaja en más de la mitad de sus horas.
    let horasEquipo = 0, horasBloque = 0;
    for (let h = Math.floor(b.inicio / 60); h * 60 < b.fin; h++) { horasBloque++; if ((disponibilidad?.[`${dow}-${h}`] || 0) >= 0.5) horasEquipo++; }
    const abierto = n >= 1 || (conHorarios && horasEquipo / Math.max(1, horasBloque) >= 0.5);
    if (n > 0 || abierto) cells.push({ dow, hour: b.hour, total: n, avg: n / weeks });
    if (abierto) abiertas.push(`${dow}-${b.hour}`);
  }
  const porDia = [1, 2, 3, 4, 5, 6, 7].map((dow) => ({ dow, total: porDow.get(dow) || 0, avg: (porDow.get(dow) || 0) / weeks }));
  return { weeks, desde, hasta, totalReservas: total, cells, porDia, horas: bloques.map((b) => b.hour), abiertas, fuente: conHorarios ? "horarios" : "reservas", modo: "bloques", bloques };
}
// Nombre de una fila del mapa: «10:00» (por horas) o «10:00–13:00» (por bloques).
export function etiquetaFila(mapa: DemandMap, hour: number): string {
  const b = mapa.modo === "bloques" ? mapa.bloques?.find((x) => x.hour === hour) : undefined;
  return b ? b.etiqueta : `${String(hour).padStart(2, "0")}:00`;
}

export function construirMapa(rows: DemandRow[], weeks: number, desde: string, hasta: string, disponibilidad?: Record<string, number>): DemandMap {
  const bloques = detectarBloques(rows, desde, hasta);
  if (bloques) return construirMapaBloques(rows, weeks, desde, hasta, bloques, disponibilidad);
  const ocupado = new Map<string, number>();            // «dow-hora» -> horas de agenda ocupadas en el período
  const diaOcupado = new Map<number, number>();
  let total = 0, minutosTotales = 0;
  for (const r of rows) {
    if (!CUENTAN.has(r.status) || !r.date || r.date < desde || r.date > hasta) continue;
    const reparto = minutosPorHora(r.start_time, r.end_time);
    if (reparto.size === 0) continue;
    const dow = diaSemana(r.date);
    for (const [h, min] of Array.from(reparto.entries())) {
      ocupado.set(`${dow}-${h}`, (ocupado.get(`${dow}-${h}`) || 0) + min / 60);
      diaOcupado.set(dow, (diaOcupado.get(dow) || 0) + min / 60);
      minutosTotales += min;
    }
    total++;
  }
  // Duración típica de una cita del negocio (en horas): convierte horas ocupadas en «reservas equivalentes».
  const duracionTipica = total > 0 ? Math.max(0.25, minutosTotales / 60 / total) : 1;
  const tot = new Map<string, number>(Array.from(ocupado.entries()).map(([k, v]) => [k, v / duracionTipica]));
  const dia = new Map<number, number>(Array.from(diaOcupado.entries()).map(([k, v]) => [k, v / duracionTipica]));
  const conHorarios = !!disponibilidad && Object.values(disponibilidad).some((v) => v > 0);
  const claves = new Set<string>(Array.from(tot.keys()));
  if (conHorarios) for (const k of Object.keys(disponibilidad!)) if (disponibilidad![k] > 0) claves.add(k);
  const cells: DemandCell[] = Array.from(claves).map((k) => {
    const [dow, hour] = k.split("-").map(Number); const n = tot.get(k) || 0;
    const c: DemandCell = { dow, hour, total: n, avg: n / weeks };
    if (conHorarios) { c.disp = (disponibilidad![k] || 0) / weeks; c.ocupado = (ocupado.get(k) || 0) / weeks; }
    return c;
  });
  // Horas a mostrar: de la primera a la ultima que tenga al menos 3 reservas en el periodo (descarta horas sueltas fuera de horario).
  const porHora = new Map<number, number>();
  for (const c of cells) porHora.set(c.hour, (porHora.get(c.hour) || 0) + c.total);
  const escala = escalaNegocio(total, weeks);
  const activas = Array.from(porHora.entries()).filter(([, n]) => n >= 3 && n / weeks >= 2 * escala).map(([h]) => h); // al menos 2 reservas por semana en total (menos en un negocio chico)
  const horas: number[] = [];
  if (activas.length) for (let h = Math.min(...activas); h <= Math.max(...activas); h++) horas.push(h);
  const porDia = [1, 2, 3, 4, 5, 6, 7].map((dow) => ({ dow, total: dia.get(dow) || 0, avg: (dia.get(dow) || 0) / weeks }));
  const abiertas = calcularAbiertas(cells, conHorarios, escala);
  // Con horarios cargados, las filas del mapa son las horas en que algún día atiende (de la primera a la última).
  let horasFinal = horas;
  if (conHorarios) {
    const hs = abiertas.map((k) => Number(k.split("-")[1]));
    horasFinal = []; if (hs.length) for (let h = Math.min(...hs); h <= Math.max(...hs); h++) horasFinal.push(h);
  }
  return { weeks, desde, hasta, totalReservas: total, cells, porDia, horas: horasFinal, abiertas, fuente: conHorarios ? "horarios" : "reservas" };
}

// Qué horas atiende cada día. El rango de cada día sale de CUÁNDO HAY RESERVAS (de la primera a la última hora con actividad de ese día): los
// horarios cargados suelen ser más amplios que lo que de verdad se atiende (ej. un profesional con horario hasta las 23 aunque se cierra a las 20),
// así que nunca amplían el rango. Los horarios del equipo sirven para sacar de ese rango lo que no se atiende (colaciones, bloqueos,
// vacaciones): esas horas quedan fuera del horario, no como «demanda baja».
function calcularAbiertas(cells: DemandCell[], conHorarios: boolean, escala: number): string[] {
  const out: string[] = [];
  for (let dow = 1; dow <= 7; dow++) {
    const delDia = cells.filter((c) => c.dow === dow);
    const activas = delDia.filter((c) => c.total >= 3 && c.avg >= escala).map((c) => c.hour);
    if (!activas.length) continue;
    const pico = conHorarios ? Math.max(0, ...delDia.map((c) => c.disp || 0)) : 0;
    for (let h = Math.min(...activas); h <= Math.max(...activas); h++) {
      const c = delDia.find((x) => x.hour === h);
      if (!conHorarios || (c?.disp || 0) >= Math.max(0.05, pico * 0.15) || (c?.total || 0) >= 3) out.push(`${dow}-${h}`);
    }
  }
  // Negocio nuevo o con muy pocas reservas: aún no se puede saber cuándo atiende por las reservas, se usa su horario cargado.
  if (!out.length && conHorarios) {
    for (let dow = 1; dow <= 7; dow++) {
      const delDia = cells.filter((c) => c.dow === dow && (c.disp || 0) > 0);
      const pico = Math.max(0, ...delDia.map((c) => c.disp || 0));
      for (const c of delDia) if ((c.disp || 0) >= Math.max(0.05, pico * 0.15)) out.push(`${dow}-${c.hour}`);
    }
  }
  return out;
}
const cacheAbiertas = new WeakMap<DemandMap, Set<string>>();
export function estaAbierta(mapa: DemandMap, dow: number, hour: number): boolean {
  let s = cacheAbiertas.get(mapa);
  if (!s) { s = new Set(mapa.abiertas || []); cacheAbiertas.set(mapa, s); }
  // Mapas sin la lista (versiones anteriores): todo lo que tiene actividad cuenta como abierto.
  return (mapa.abiertas ? s.has(`${dow}-${hour}`) : mapa.cells.some((c) => c.dow === dow && c.hour === hour));
}
// Lo que se compara entre celdas: con horarios, qué parte del tiempo disponible está ocupada (justo con horas parcialmente disponibles);
// sin horarios, las reservas por semana.
export const valorCelda = (c: DemandCell | undefined): number => (!c ? 0 : c.disp && c.disp > 0 ? Math.min(1, (c.ocupado || 0) / c.disp) : c.avg);
// «Lun a Vie 10:00–20:00 · Sáb 9:00–17:00»: el horario que se está considerando, agrupando los días iguales.
export function resumenHorario(mapa: DemandMap): string {
  if (mapa.modo === "bloques") {
    const porDia = (dow: number) => (mapa.bloques || []).filter((b) => (mapa.abiertas || []).includes(`${dow}-${b.hour}`)).map((b) => b.etiqueta).join(" · ");
    const grupos: { dias: number[]; txt: string }[] = [];
    for (let dow = 1; dow <= 7; dow++) { const txt = porDia(dow); if (!txt) continue; const g = grupos.find((x) => x.txt === txt); if (g) g.dias.push(dow); else grupos.push({ dias: [dow], txt }); }
    const nom = (ds: number[]) => (ds.length === 1 ? DIAS[ds[0] - 1] : ds.every((d, i) => i === 0 || d === ds[i - 1] + 1) ? `${DIAS[ds[0] - 1]} a ${DIAS[ds[ds.length - 1] - 1]}` : ds.map((d) => DIAS[d - 1]).join(", "));
    return grupos.map((g) => `${nom(g.dias)}: ${g.txt}`).join(" | ");
  }
  const ventana = (dow: number): [number, number] | null => {
    const hs = (mapa.abiertas || []).filter((k) => k.startsWith(`${dow}-`)).map((k) => Number(k.split("-")[1]));
    return hs.length ? [Math.min(...hs), Math.max(...hs) + 1] : null;
  };
  const grupos: { dias: number[]; v: [number, number] }[] = [];
  for (let dow = 1; dow <= 7; dow++) {
    const v = ventana(dow); if (!v) continue;
    const g = grupos.find((x) => x.v[0] === v[0] && x.v[1] === v[1]);
    if (g) g.dias.push(dow); else grupos.push({ dias: [dow], v });
  }
  const nombre = (ds: number[]) => (ds.length === 1 ? DIAS[ds[0] - 1] : ds.every((d, i) => i === 0 || d === ds[i - 1] + 1) ? `${DIAS[ds[0] - 1]} a ${DIAS[ds[ds.length - 1] - 1]}` : ds.map((d) => DIAS[d - 1]).join(", "));
  const hh = (h: number) => `${String(h).padStart(2, "0")}:00`;
  return grupos.map((g) => `${nombre(g.dias)} ${hh(g.v[0])}–${hh(g.v[1])}`).join(" · ");
}

export interface HorarioFlojo { dow: number; hour: number; avg: number }
// Los horarios mas flojos: solo dentro del rango de horas del dia (primera a ultima hora con al menos 1 reserva por semana ese dia; asi las horas de cierre no cuentan como flojas), sin dias casi cerrados
// y sin las horas marcadas como descanso. Ordenados de menos a mas reservas.
export function horariosFlojos(mapa: DemandMap, descanso: number[] = [], max = 8): HorarioFlojo[] {
  const out: (HorarioFlojo & { v: number })[] = [];
  const escala = escalaNegocio(mapa.totalReservas, mapa.weeks);
  const mapaCelda = new Map(mapa.cells.map((c) => [`${c.dow}-${c.hour}`, c]));
  for (const d of mapa.porDia) {
    if (esDiaCerradoMapa(mapa, d, escala)) continue; // día sin atención (ej. domingo)
    // Solo las horas en que ese día sí se atiende: las de cierre, colación o fuera del horario no cuentan como «flojas».
    const horasDia = (mapa.abiertas || []).filter((k) => k.startsWith(`${d.dow}-`)).map((k) => Number(k.split("-")[1])).sort((x, y) => x - y);
    for (const h of horasDia) {
      if (descanso.includes(h)) continue;
      const c = mapaCelda.get(`${d.dow}-${h}`);
      out.push({ dow: d.dow, hour: h, avg: c?.avg ?? 0, v: mapa.fuente === "horarios" ? valorCelda(c) : (c?.avg ?? 0) });
    }
  }
  return out.sort((a, b) => a.v - b.v || a.dow - b.dow || a.hour - b.hour).slice(0, max).map(({ v: _v, ...r }) => r);
}

// Un día está cerrado si no tiene horas de atención (con horarios) o casi no tiene reservas (sin horarios).
function esDiaCerradoMapa(mapa: DemandMap, d: { dow: number; avg: number }, escala: number): boolean {
  if (mapa.fuente === "horarios") return !(mapa.abiertas || []).some((k) => k.startsWith(`${d.dow}-`));
  return esDiaCerrado(d.avg, escala);
}

export type Nivel = "fuerte" | "normal" | "flojo";
// Dias: frente al promedio de los dias en que se atiende (los casi cerrados no cuentan).
export function nivelesPorDia(mapa: DemandMap): Map<number, { avg: number; nivel: Nivel | "cerrado" }> {
  const escala = escalaNegocio(mapa.totalReservas, mapa.weeks);
  const abiertos = mapa.porDia.filter((d) => !esDiaCerradoMapa(mapa, d, escala));
  const media = abiertos.length ? abiertos.reduce((t, d) => t + d.avg, 0) / abiertos.length : 0;
  return new Map(mapa.porDia.map((d) => [d.dow, { avg: d.avg, nivel: esDiaCerradoMapa(mapa, d, escala) ? "cerrado" : d.avg < media * 0.75 ? "flojo" : d.avg > media * 1.2 ? "fuerte" : "normal" }]));
}
// Horas: promedio de reservas por semana en esa hora, sumando los dias en que se atiende.
export function nivelesPorHora(mapa: DemandMap): { hour: number; avg: number; nivel: Nivel }[] {
  const escala = escalaNegocio(mapa.totalReservas, mapa.weeks);
  const abiertos = new Set(mapa.porDia.filter((d) => !esDiaCerradoMapa(mapa, d, escala)).map((d) => d.dow));
  // Cada hora se promedia solo entre los días en que esa hora SÍ se atiende (si el sábado se cierra a las 17, las 18 no se promedian con el sábado).
  const base = mapa.horas.map((hour) => {
    const dias = Array.from(abiertos).filter((dow) => estaAbierta(mapa, dow, hour));
    return { hour, n: dias.length, avg: dias.reduce((t, dow) => t + (mapa.cells.find((c) => c.hour === hour && c.dow === dow)?.avg ?? 0), 0) / Math.max(1, dias.length) };
  }).filter((b) => b.n > 0).map(({ hour, avg }) => ({ hour, avg }));
  const media = base.length ? base.reduce((t, b) => t + b.avg, 0) / base.length : 0;
  return base.map((b) => ({ ...b, nivel: b.avg < media * 0.6 ? "flojo" : b.avg > media * 1.3 ? "fuerte" : "normal" }));
}
// Una celda (dia + hora) frente a la mas fuerte del mapa.
export function nivelCelda(avg: number, maxAvg: number): Nivel { const r = maxAvg > 0 ? avg / maxAvg : 0; return r >= 0.6 ? "fuerte" : r <= 0.3 ? "flojo" : "normal"; }
