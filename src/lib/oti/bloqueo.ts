import { norm } from "./texto";

// Entiende pedidos como «cierra manana a Nicolas», «bloquea el 28 de octubre a Javier» o «cierra del 28 al 30 de octubre mi agenda».
// Es una regla simple, no IA: si algo no se entiende con seguridad, devuelve que FALTA ese dato y Oti lo pregunta. Nunca adivina un profesional ni una fecha.
export interface MiembroEquipo { id: string; name: string }
export type PedidoBloqueo =
  | { ok: true; profesional: MiembroEquipo; desde: string; hasta: string; dias: number }
  | { ok: false; falta: "profesional" | "fecha" | "hasta" | "ambiguo" | "pasado" | "rango" | "largo"; candidatos?: MiembroEquipo[]; detalle?: string };

export const MAX_DIAS_BLOQUEO = 120;
const DAY = 86400000;
const MESES: Record<string, number> = { enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12 };
const SEMANA: Record<string, number> = { domingo: 0, lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6 };
const MES_RE = Object.keys(MESES).join("|");
const DIA_RE = Object.keys(SEMANA).join("|");

const ms = (iso: string) => { const [y, m, d] = iso.split("-").map(Number); return Date.UTC(y, m - 1, d); };
const iso = (t: number) => { const d = new Date(t); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`; };
const valida = (y: number, m: number, d: number) => { const t = new Date(Date.UTC(y, m - 1, d)); return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d; };
// Dia y mes sin ano: el proximo que no haya pasado.
function sinAno(hoy: string, m: number, d: number): string | null {
  const y = Number(hoy.slice(0, 4));
  for (const yy of [y, y + 1]) if (valida(yy, m, d) && ms(`${yy}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`) >= ms(hoy)) return `${yy}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  return null;
}
function anoCompleto(a: string | undefined): number | null { if (!a) return null; const n = Number(a); return a.length === 2 ? 2000 + n : n; }

interface Fecha { iso: string; pos: number; fin: number }
// Todas las fechas que aparecen en el texto, en orden.
function fechas(t: string, hoy: string): Fecha[] {
  const out: Fecha[] = [];
  const add = (iso_: string | null, m: RegExpMatchArray) => { if (iso_) out.push({ iso: iso_, pos: m.index ?? 0, fin: (m.index ?? 0) + m[0].length }); };
  for (const m of Array.from(t.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g))) add(valida(+m[1], +m[2], +m[3]) ? `${m[1]}-${m[2]}-${m[3]}` : null, m);
  for (const m of Array.from(t.matchAll(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/g))) {
    if (/^\d{4}$/.test(m[1])) continue;
    const d = +m[1], mo = +m[2], y = anoCompleto(m[3]);
    add(y ? (valida(y, mo, d) ? `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}` : null) : sinAno(hoy, mo, d), m);
  }
  for (const m of Array.from(t.matchAll(new RegExp(`\\b(\\d{1,2})(?: de)? (${MES_RE})(?: de (\\d{4}))?\\b`, "g")))) {
    const d = +m[1], mo = MESES[m[2]], y = m[3] ? +m[3] : null;
    add(y ? (valida(y, mo, d) ? `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}` : null) : sinAno(hoy, mo, d), m);
  }
  for (const m of Array.from(t.matchAll(/\bpasado manana\b/g))) add(iso(ms(hoy) + 2 * DAY), m);
  for (const m of Array.from(t.matchAll(/\b(?<!pasado )manana\b/g))) add(iso(ms(hoy) + DAY), m);
  for (const m of Array.from(t.matchAll(/\bhoy\b/g))) add(hoy, m);
  for (const m of Array.from(t.matchAll(new RegExp(`\\b(?:el |este |proximo )?(${DIA_RE})\\b`, "g")))) {
    const wd = SEMANA[m[1]];
    let t0 = ms(hoy) + DAY; // el proximo, nunca hoy
    while (new Date(t0).getUTCDay() !== wd) t0 += DAY;
    add(iso(t0), m);
  }
  return out.sort((a, b) => a.pos - b.pos);
}

const YA_DICHO_PREGUNTA = /^(como|donde|cual|cuales|que|puedo|se puede|por que|quien)\b/;
const VERBO = /\b(cierr\w*|cerrar|bloque\w*)\b/;
const OTRO_TEMA = /\b(caja|mes|mensual|ventas?|sesion|cuenta|boleta|factura)\b/;

// null = no parece un pedido de bloqueo (va a la ayuda). Si lo parece, devuelve el pedido completo o lo que falta.
export function entenderBloqueo(texto: string, hoy: string, equipo: MiembroEquipo[], yoId?: string | null): PedidoBloqueo | null {
  const t = norm(texto);
  if (!VERBO.test(t) || OTRO_TEMA.test(t) || YA_DICHO_PREGUNTA.test(t)) return null;
  const fs = fechas(t, hoy);
  const adelante = /\b(de aqui en adelante|en adelante|desde ahora|para siempre|indefinid\w*)\b/.test(t);
  const porDias = t.match(/\bpor (\d{1,3}) dias?\b/);
  if (fs.length === 0 && !adelante && !porDias && !/\b(dia|dias|completo|agenda)\b/.test(t)) return null;

  // Profesional
  let prof: MiembroEquipo | null = null;
  if (/\b(mi agenda|mi propia agenda|a mi|yo)\b/.test(t) && yoId) prof = equipo.find((m) => m.id === yoId) ?? null;
  if (!prof) {
    const hallados = equipo.filter((m) => {
      const n = norm(m.name);
      if (!n) return false;
      if (` ${t} `.includes(` ${n} `)) return true;
      const primero = n.split(" ")[0];
      return primero.length >= 3 && new RegExp(`\\b${primero}\\b`).test(t);
    });
    if (hallados.length > 1) return { ok: false, falta: "ambiguo", candidatos: hallados };
    prof = hallados[0] ?? (equipo.length === 1 ? equipo[0] : null);
  }
  if (!prof) return { ok: false, falta: "profesional" };

  // Fechas: «del A al B», «hasta B», «por N dias», «de aqui en adelante»
  let desde: string | null = null, hasta: string | null = null;
  const posHasta = t.search(/\bhasta\b/);
  const rango = t.match(new RegExp(`\\bdel (\\d{1,2}) al (\\d{1,2}) de (${MES_RE})(?: de (\\d{4}))?\\b`));
  if (rango) {
    const mo = MESES[rango[3]], y = rango[4] ? +rango[4] : null;
    const mk = (d: number) => (y ? (valida(y, mo, d) ? `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}` : null) : sinAno(hoy, mo, d));
    desde = mk(+rango[1]); hasta = mk(+rango[2]);
    if (!desde || !hasta) return { ok: false, falta: "rango" };
  } else if (posHasta >= 0 && fs.some((f) => f.pos > posHasta)) {
    hasta = fs.find((f) => f.pos > posHasta)!.iso;
    desde = fs.find((f) => f.pos < posHasta)?.iso ?? hoy;
  } else if (fs.length >= 2 && /\b(al|a|y)\b/.test(t.slice(fs[0].fin, fs[1].pos))) {
    desde = fs[0].iso; hasta = fs[1].iso;
  } else if (fs.length >= 1) {
    desde = fs[0].iso;
    if (porDias) hasta = iso(ms(desde) + (Number(porDias[1]) - 1) * DAY);
    else if (adelante) return { ok: false, falta: "hasta" };
    else hasta = desde;
  } else if (porDias) {
    desde = hoy; hasta = iso(ms(hoy) + (Number(porDias[1]) - 1) * DAY);
  } else if (adelante) {
    return { ok: false, falta: "hasta" };
  } else {
    return { ok: false, falta: "fecha" };
  }

  if (ms(desde!) < ms(hoy)) return { ok: false, falta: "pasado", detalle: desde! };
  if (ms(hasta!) < ms(desde!)) return { ok: false, falta: "rango" };
  const dias = Math.round((ms(hasta!) - ms(desde!)) / DAY) + 1;
  if (dias > MAX_DIAS_BLOQUEO) return { ok: false, falta: "largo", detalle: String(dias) };
  return { ok: true, profesional: prof, desde: desde!, hasta: hasta!, dias };
}

// Para mostrar: «martes 28 de octubre» (sin zona horaria: la fecha ya es de Chile).
export function etiquetaFecha(isoDate: string): string {
  const d = new Date(ms(isoDate));
  const dias = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
  const meses = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  return `${dias[d.getUTCDay()]} ${d.getUTCDate()} de ${meses[d.getUTCMonth()]}`;
}
