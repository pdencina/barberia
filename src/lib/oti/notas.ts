// Notas del administrador que Oti deja en el Dashboard («tengo que pagar la luz el 5»). Pura: se prueba sin base de datos.
// Solo ENTIENDE la frase; guardar y borrar lo hace /api/notas, que valida sesión, rol y negocio, y Oti siempre pide confirmar antes.
import { norm } from "@/lib/oti/texto";

export interface NotaOti { id: string; texto: string; dia: number | null; created_at?: string }

export type PedidoNota =
  | { tipo: "crear"; texto: string; dia: number | null }
  | { tipo: "listar" }
  | { tipo: "borrar"; consulta: string };

// Sin tildes pero del MISMO largo que el original (así se puede cortar el texto original por la posición hallada en el plano).
const plano = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const VERBO_NOTA = /\b(recuerdame|recordarme|recuerda me|anotame una nota|anotame|dejame una nota|deja una nota|ponme una nota|pon una nota|apuntame|no se me olvide|que no se me olvide)\b/;
const VERBO_OBLIGACION = /\b(tengo que|tengo pendiente|debo|hay que|me toca|tengo)\b/;
const PREFIJO = /^\s*(oti[ ,:]*)?(por favor[ ,:]*)?(recuerdame|recordarme|recuerda me|anotame una nota|anotame|dejame una nota|deja una nota|ponme una nota|pon una nota|apuntame|que no se me olvide|no se me olvide|nota\s*:|tengo que|tengo pendiente|debo|hay que|me toca)[ ,:]*(que |de |sobre )?/;
const DIA = /\b(?:el|los|cada|dia)\s+(?:dia\s+)?(\d{1,2})\b(?!\s*(?:de\s+)?(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre))/;
const MONTO = /\$\s?\d|\b\d+\s?(lucas|luca|mil|k)\b/;

const mayuscula = (t: string) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);

export function entenderNota(texto: string): PedidoNota | null {
  const original = String(texto ?? "").trim();
  const p = plano(original);
  const t = norm(original);
  if (!t) return null;

  // Ver mis notas
  if (/\b(mis notas|que notas tengo|ver (mis |las )?notas|muestrame (mis |las )?notas|lista de (mis )?notas|que tengo anotado)\b/.test(t)) return { tipo: "listar" };

  // Borrar una nota: «borra la nota de la luz», «elimina mi nota de pagar el arriendo»
  if (/\b(borra|borrar|elimina|eliminar|quita|quitar|saca|sacar|bota|botar)\b.*\bnota/.test(t) || /\b(borra|elimina|quita)\b.*\brecordatorio\b/.test(t)) {
    const consulta = t.replace(/\b(oti|por favor|borra|borrar|elimina|eliminar|quita|quitar|saca|sacar|bota|botar|la|el|mi|mis|las|los|nota|notas|recordatorio|de|sobre|que|dice|dijo)\b/g, " ").replace(/\s+/g, " ").trim();
    return { tipo: "borrar", consulta };
  }

  // Crear una nota. Con un monto en pesos es un gasto o ingreso (otro flujo), no una nota.
  if (MONTO.test(p)) return null;
  const diaM = DIA.exec(p);
  const dia = diaM && Number(diaM[1]) >= 1 && Number(diaM[1]) <= 31 ? Number(diaM[1]) : null;
  const explicito = VERBO_NOTA.test(p) || /(^|\s)nota\s*:/.test(p); // «nota:» con dos puntos; la palabra suelta «nota» no basta («nota de crédito»)
  // «tengo que / debo / hay que…» solo cuenta como nota si trae un día («tengo que pagar la luz el 5»): sin día es una frase común.
  const obligacionConDia = !explicito && dia !== null && VERBO_OBLIGACION.test(p);
  if (!explicito && !obligacionConDia) return null;

  // Se quita el comienzo («oti, anótame una nota que hay que…»): hasta dos veces, por si vienen dos juntos.
  let resto = original;
  for (let i = 0; i < 2; i++) { const m = PREFIJO.exec(plano(resto)); if (!m || m[0].length === 0) break; resto = resto.slice(m[0].length); }
  let cuerpo = resto.trim().replace(/^[:,.\-–\s]+|[\s.]+$/g, "");
  if (cuerpo.length < 3) return null;
  if (cuerpo.length > 200) cuerpo = cuerpo.slice(0, 200).trim();
  // «tengo que pagar la luz» -> «Pagar la luz el 5»: el infinitivo queda como título; si el día ya está escrito se deja tal cual.
  return { tipo: "crear", texto: mayuscula(cuerpo), dia };
}

// ---- validación (la usa la API) ----
export function validarNota(body: any): { ok: true; value: { texto: string; dia: number | null } } | { ok: false; error: string } {
  const texto = typeof body?.texto === "string" ? body.texto.trim() : "";
  if (texto.length < 1 || texto.length > 200) return { ok: false, error: "Escribe la nota (hasta 200 caracteres)" };
  let dia: number | null = null;
  if (body?.dia !== undefined && body?.dia !== null && body?.dia !== "") {
    const d = Number(body.dia);
    if (!Number.isInteger(d) || d < 1 || d > 31) return { ok: false, error: "El día del mes debe estar entre 1 y 31" };
    dia = d;
  }
  return { ok: true, value: { texto, dia } };
}

// ---- recordatorio de vencimiento ----
const ultimoDia = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

// Días que faltan para el próximo «día N» del mes (0 = hoy). Si el mes no tiene ese día (ej. 31 en abril) se usa el último.
export function diasHastaDia(dia: number, hoy: string): number {
  const [y, m, d] = hoy.split("-").map(Number);
  const objetivoEsteMes = Math.min(dia, ultimoDia(y, m));
  if (objetivoEsteMes >= d) return objetivoEsteMes - d;
  const ny = m === 12 ? y + 1 : y, nm = m === 12 ? 1 : m + 1;
  return ultimoDia(y, m) - d + Math.min(dia, ultimoDia(ny, nm));
}

export interface EstadoNota { texto: string; urgente: boolean }
export function estadoVencimiento(dia: number | null, hoy: string): EstadoNota | null {
  if (dia === null) return null;
  const n = diasHastaDia(dia, hoy);
  if (n === 0) return { texto: "Es hoy", urgente: true };
  if (n === 1) return { texto: "Mañana", urgente: true };
  if (n <= 3) return { texto: `En ${n} días`, urgente: true };
  return { texto: `El día ${dia} (en ${n} días)`, urgente: false };
}

// Notas ordenadas: primero las que vencen antes; las sin día, al final por antigüedad.
export function ordenarNotas<T extends NotaOti>(notas: T[], hoy: string): T[] {
  return [...notas].sort((a, b) => {
    const da = a.dia === null ? 999 : diasHastaDia(a.dia, hoy), db = b.dia === null ? 999 : diasHastaDia(b.dia, hoy);
    return da - db || String(a.created_at || "").localeCompare(String(b.created_at || ""));
  });
}

// Qué notas calzan con lo que pidió borrar. Sin palabras claras: todas (la persona elige).
const PALABRAS_VACIAS = new Set(["para", "con", "una", "uno", "del", "que", "por", "pagar", "pago"]);
export function buscarNotas(notas: NotaOti[], consulta: string): NotaOti[] {
  const palabras = norm(consulta).split(" ").filter((w) => w.length >= 3 && !PALABRAS_VACIAS.has(w));
  if (palabras.length === 0) return notas;
  const puntaje = notas.map((n) => ({ n, s: palabras.filter((w) => norm(n.texto).includes(w)).length })).filter((x) => x.s > 0);
  if (!puntaje.length) return [];
  const mejor = Math.max(...puntaje.map((x) => x.s));
  return puntaje.filter((x) => x.s === mejor).map((x) => x.n);
}
