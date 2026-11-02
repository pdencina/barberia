// Oti como asistente de gastos e ingresos PERSONALES: entiende frases como «hoy gasté $123.000 en una máquina de cortar el pelo»,
// «compré pan me salió $1.200» o «pagué el metro $1.200» y arma el movimiento para que la persona lo confirme. Sin IA: reglas simples.
// Nunca guarda solo: Oti muestra lo que entendió y la persona confirma. El permiso y el dueño del dato lo valida SIEMPRE el servidor.
export type TipoPersonal = "gasto" | "ingreso";
export const CATEGORIAS_GASTO = ["Comida", "Transporte", "Herramientas y trabajo", "Hogar y cuentas", "Salud", "Ropa", "Ocio", "Educación", "Otros"] as const;
export const CATEGORIAS_INGRESO = ["Trabajo extra", "Venta", "Regalo", "Otros ingresos"] as const;
export interface MovimientoPersonal { tipo: TipoPersonal; monto: number; descripcion: string; categoria: string; fecha: string }
export type PedidoPersonal = { ok: true; movimiento: MovimientoPersonal } | { ok: false; falta: "monto" };

const DAY = 86400000;
const ms = (iso: string) => { const [y, m, d] = iso.split("-").map(Number); return Date.UTC(y, m - 1, d); };
const iso = (t: number) => { const d = new Date(t); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`; };
// Minusculas y sin tildes, pero CONSERVA «$», «.» y «,» (los montos chilenos son «$123.000»).
const base = (s: string) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

const VERBO_GASTO = /\b(gaste|gastamos|gasto|compre|compramos|pague|pagamos|me salio|me costo|salio|costo|abone|cargue|recargue|invertí|inverti|desembolse|aporte)\b/;
const VERBO_INGRESO = /\b(recibi|me pagaron|me pago|me depositaron|me transfirieron|me llego|me llegaron|gane|cobre|ingrese|ingreso de|vendi|me regalaron|me dieron)\b/;
const PREGUNTA = /^(cuanto|cuantos|cuanta|cual|como|donde|que|quien|puedo|se puede|por que)\b/;
const OTRO_TEMA = /\b(cierra|cerrar|bloque\w*|agenda|cita|citas|reserva|cliente|clientes|planilla|arriendo del profesional|comision de|boleta|factura)\b/;

// Monto en pesos. «$123.000», «123.000», «123000», «1.200», «20 lucas», «2 mil», «1,5 mil»? (no: solo enteros y miles con punto).
export function extraerMonto(texto: string): { monto: number; token: string } | null {
  const t = base(texto);
  let m = t.match(/(\d{1,3}(?:[.,]\d{3})*|\d+)\s*(lucas?|luca|k|mil)\b/);
  if (m) { const n = Number(m[1].replace(/[.,]/g, "")); if (n > 0) return { monto: n * 1000, token: m[0] }; }
  m = t.match(/\$\s*(\d{1,3}(?:[.,]\d{3})+|\d+)/);
  if (m) return { monto: Number(m[1].replace(/[.,]/g, "")), token: m[0] };
  m = t.match(/\b(\d{1,3}(?:[.,]\d{3})+)\b/);
  if (m) return { monto: Number(m[1].replace(/[.,]/g, "")), token: m[0] };
  m = t.match(/\b(\d{3,9})\s*(pesos|clp)?\b/);
  if (m) return { monto: Number(m[1]), token: m[0] };
  m = t.match(/\b(\d{1,2})\s*pesos\b/);
  if (m) return { monto: Number(m[1]), token: m[0] };
  return null;
}

const MESES: Record<string, number> = { enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12 };
const SEMANA: Record<string, number> = { domingo: 0, lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6 };
// Fecha del gasto: hoy por defecto; «ayer», «anteayer», «el lunes» (el ultimo), «el 28 de octubre», «28/10».
export function extraerFecha(texto: string, hoy: string): { fecha: string; token: string | null } {
  const t = base(texto);
  let m = t.match(/\b(antes de ayer|anteayer|antier)\b/); if (m) return { fecha: iso(ms(hoy) - 2 * DAY), token: m[0] };
  m = t.match(/\bayer\b/); if (m) return { fecha: iso(ms(hoy) - DAY), token: m[0] };
  m = t.match(/\bhoy\b/); if (m) return { fecha: hoy, token: m[0] };
  m = t.match(new RegExp(`\\bel (${Object.keys(SEMANA).join("|")})\\b`));
  if (m) { let x = ms(hoy) - DAY; while (new Date(x).getUTCDay() !== SEMANA[m[1]]) x -= DAY; return { fecha: iso(x), token: m[0] }; }
  m = t.match(new RegExp(`\\b(?:el )?(\\d{1,2}) de (${Object.keys(MESES).join("|")})\\b`));
  if (m) { const y = Number(hoy.slice(0, 4)); const mo = MESES[m[2]], d = Number(m[1]); let f = `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`; if (ms(f) > ms(hoy)) f = `${y - 1}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`; if (!Number.isNaN(ms(f))) return { fecha: f, token: m[0] }; }
  m = t.match(/\b(\d{1,2})[/-](\d{1,2})\b/);
  if (m) { const y = Number(hoy.slice(0, 4)); const d = Number(m[1]), mo = Number(m[2]); if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) { let f = `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`; if (ms(f) > ms(hoy)) f = `${y - 1}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`; return { fecha: f, token: m[0] }; } }
  return { fecha: hoy, token: null };
}

const CATEGORIAS: Array<[string, RegExp]> = [
  ["Transporte", /\b(metro|bus|micro|uber|cabify|didi|taxi|colectivo|bencina|combustible|petroleo|estacionamiento|peaje|tag|pasaje|bip|tren|moto|bicicleta)\b/],
  ["Comida", /\b(pan|almuerzo|desayuno|cena|comida|cafe|bebida|jugo|agua|super|supermercado|once|colacion|empanada|pizza|sushi|helado|fruta|verdura|carne|leche|huevos|snack|completo|hamburguesa|menu)\b/],
  ["Herramientas y trabajo", /\b(maquina|tijera|tijeras|navaja|navajas|cuchilla|cuchillas|peineta|peinetas|capa|secador|plancha|herramienta|herramientas|insumo|insumos|tintura|gel|cera|aceite|shampoo|tonico|cortadora|trimmer|brocha|toalla|toallas|silla|espejo)\b/],
  ["Hogar y cuentas", /\b(luz|agua potable|gas|internet|wifi|arriendo|dividendo|gastos comunes|celular|plan|cuenta|cuentas|supermercado hogar|ferreteria|mueble|muebles|electrodomestico)\b/],
  ["Salud", /\b(farmacia|remedio|remedios|doctor|medico|dentista|examen|examenes|consulta|lentes|kine|psicologo)\b/],
  ["Ropa", /\b(ropa|zapatillas|zapatos|polera|poleras|pantalon|chaqueta|polerón|poleron|jeans|calcetines|gorro)\b/],
  ["Ocio", /\b(cine|netflix|spotify|salida|bar|copete|cerveza|fiesta|juego|juegos|concierto|entrada|entradas|regalo|paseo|viaje|gym|gimnasio)\b/],
  ["Educación", /\b(curso|taller|libro|libros|clase|clases|capacitacion|matricula|universidad|colegio|diplomado)\b/],
];
const CATEGORIAS_INGRESO_RE: Array<[string, RegExp]> = [
  ["Venta", /\b(vendi|venta|ventas)\b/],
  ["Regalo", /\b(regalo|regalaron|aguinaldo|bono)\b/],
  ["Trabajo extra", /\b(trabajo|pololo|chamba|corte|cortes|servicio|servicios|propina|propinas|me pagaron|me pago)\b/],
];
export function categoriaPara(texto: string, tipo: TipoPersonal): string {
  const t = base(texto);
  for (const [c, re] of tipo === "gasto" ? CATEGORIAS : CATEGORIAS_INGRESO_RE) if (re.test(t)) return c;
  return tipo === "gasto" ? "Otros" : "Otros ingresos";
}

// Limpia la frase para dejar solo «que fue»: «hoy gaste $123.000 en una maquina de cortar el pelo» -> «Máquina de cortar el pelo».
const PALABRAS_VERBO = new Set(["gaste", "gastamos", "gasto", "compre", "compramos", "pague", "pagamos", "abone", "cargue", "recargue", "recibi", "gane", "cobre", "vendi", "ingrese", "desembolse", "aporte", "hoy", "ayer", "anteayer", "antier"]);
const DESPUES_DE_ME = new Set(["salio", "costo", "pagaron", "pago", "deposito", "depositaron", "llego", "llegaron", "regalaron", "dieron", "transfirieron"]);
const RELLENO = new Set(["en", "por", "de", "del", "la", "el", "los", "las", "un", "una", "unos", "unas", "mi", "mis", "para", "con", "que", "a", "al", "y", "e"]);
const clave = (w: string) => base(w).replace(/[^a-z0-9$]/g, "");
function descripcion(original: string, tokenMonto: string | null, tokenFecha: string | null): string {
  let s = original.replace(/\s+/g, " ").trim();
  const esc = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Solo se quita el monto que se uso (asi «2 kilos de pan» conserva el 2).
  if (tokenMonto) s = s.replace(new RegExp(`\\$?\\s*${esc(tokenMonto).replace(/^\\\$\\s*/, "")}`, "i"), " ");
  // La fecha dicha («ayer», «el 28 de octubre»): se quita la secuencia de palabras completa.
  if (tokenFecha) {
    const clavesFecha = tokenFecha.split(" ").map(clave);
    const ps = s.split(" ");
    for (let k = 0; k + clavesFecha.length <= ps.length; k++) {
      if (clavesFecha.every((c, n) => clave(ps[k + n]) === c)) { ps.splice(k, clavesFecha.length); if (k > 0 && clave(ps[k - 1]) === "el" && /\d/.test(tokenFecha)) ps.splice(k - 1, 1); break; }
    }
    s = ps.join(" ");
  }
  const ws = s.split(" ").filter((w) => Boolean(w) && clave(w) !== "$");
  const out: string[] = [];
  for (let k = 0; k < ws.length; k++) {
    const c = clave(ws[k]);
    if (PALABRAS_VERBO.has(c)) continue;
    if (c === "me" && k + 1 < ws.length && DESPUES_DE_ME.has(clave(ws[k + 1]))) { k++; continue; }
    if (DESPUES_DE_ME.has(c) && (c === "salio" || c === "costo")) continue;
    out.push(ws[k]);
  }
  while (out.length && RELLENO.has(clave(out[0]))) out.shift();
  while (out.length && RELLENO.has(clave(out[out.length - 1]))) out.pop();
  const r = out.join(" ").replace(/^[\s,.:;\-–—¡!¿?]+|[\s,.:;\-–—¡!¿?]+$/g, "").trim();
  return r ? r.charAt(0).toUpperCase() + r.slice(1) : "";
}

// null = no parece un gasto ni un ingreso personal (va a las otras reglas de Oti).
export function entenderMovimientoPersonal(texto: string, hoy: string): PedidoPersonal | null {
  const t = base(texto).replace(/^[¿¡\s]+/, "");
  if (t.length < 3 || PREGUNTA.test(t) || OTRO_TEMA.test(t)) return null;
  const gasto = VERBO_GASTO.test(t), ingreso = VERBO_INGRESO.test(t);
  if (!gasto && !ingreso) return null;
  const monto = extraerMonto(texto);
  // «me salió» / «costó» sin gasto claro: si hay monto lo tratamos como gasto.
  const primeroIngreso = ingreso && (!gasto || t.search(VERBO_INGRESO) < t.search(VERBO_GASTO));
  const tipo: TipoPersonal = primeroIngreso ? "ingreso" : "gasto";
  if (!monto || !(monto.monto > 0)) return { ok: false, falta: "monto" };
  if (monto.monto > 100_000_000) return { ok: false, falta: "monto" };
  const f = extraerFecha(texto, hoy);
  const desc = descripcion(texto, monto.token, f.token) || (tipo === "gasto" ? "Gasto" : "Ingreso");
  return { ok: true, movimiento: { tipo, monto: monto.monto, descripcion: desc.slice(0, 200), categoria: categoriaPara(`${desc} ${t}`, tipo), fecha: f.fecha } };
}

// «¿cuánto gasté este mes?», «mis gastos de la semana», «resumen de mis gastos».
export interface ResumenPersonal { desde: string; hasta: string; etiqueta: string; tipo: "gasto" | "ingreso" | "balance" }
export function entenderResumenPersonal(texto: string, hoy: string, periodo: (t: string, hoy: string) => { desde: string; hasta: string; etiqueta: string } | null): ResumenPersonal | null {
  const t = base(texto);
  const pregunta = /\b(cuanto|cuanta|cuantos|resumen|mis gastos|mis ingresos|mi balance|llevo)\b/.test(t);
  const gasto = /\b(gaste|gastado|gastos|gasto|he gastado|gastamos)\b/.test(t);
  const ingreso = /\b(ingresos|ingrese|recibi|he recibido|gane|he ganado extra)\b/.test(t) && /\b(mis|personal|personales|extra)\b/.test(t);
  const personal = /\b(mis|mi|personal|personales|gaste|gastado|llevo)\b/.test(t);
  if (!pregunta || !personal || (!gasto && !ingreso && !/\bbalance\b/.test(t))) return null;
  if (/\b(negocio|equipo|profesional|barbero|clientes?|ventas|caja)\b/.test(t)) return null;
  const p = periodo(t, hoy) || { desde: `${hoy.slice(0, 7)}-01`, hasta: hoy, etiqueta: "este mes (hasta hoy)" };
  return { ...p, tipo: /\bbalance\b/.test(t) ? "balance" : ingreso && !gasto ? "ingreso" : "gasto" };
}
