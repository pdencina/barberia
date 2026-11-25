// Precio y duración de un servicio con el catálogo REAL, sin IA: "¿cuánto cuesta un corte?", "¿cuánto demora el rizo permanente?".
// Tolera nombres repetidos (el mismo servicio cargado para varios profesionales) y errores de ortografía. Si no hay una respuesta clara, null.
import type { DatosFaq } from "./faq-fija";
import { palabras } from "./servicio-profesional";

const PREGUNTA = /\b(cuanto|cuantos)\b.*\b(cuesta|cuestan|vale|valen|sale|salen|cobran|cobra)\b|\b(precio|precios|valor)\b/;
const DURACION = /\b(cuanto|cuantos)\b.*\b(demora|demoran|dura|duran|tarda|tardan|toma|toman)\b|\b(duracion|cuanto tiempo)\b/;
const RUIDO = new Set(["cuanto", "cuantos", "cuesta", "cuestan", "vale", "valen", "sale", "salen", "cobran", "cobra", "precio", "precios", "valor", "demora", "demoran", "dura", "duran", "tarda", "tardan", "toma", "toman", "duracion", "tiempo", "con", "para", "del", "los", "las", "una", "uno", "que", "esta", "esto", "hacer", "hacerme", "quiero", "saber", "favor", "por", "hola", "buenas", "tardes", "dias", "noches", "ahora"]);
const calza = (a: string, b: string) => a === b || (Math.min(a.length, b.length) >= 4 && (a.startsWith(b) || b.startsWith(a)));
const peso = new Intl.NumberFormat("es-CL");
const limpio = (n: string) => n.replace(/\s+/g, " ").trim();
const dur = (m: number) => (m >= 60 ? `${Math.floor(m / 60)} ${Math.floor(m / 60) === 1 ? "hora" : "horas"}${m % 60 ? ` y ${m % 60} min` : ""}` : `${m} min`);

export function responderPrecioServicio(texto: string, datos: DatosFaq | null): string | null {
  if (!datos || typeof texto !== "string" || texto.length > 200) return null;
  const t = palabras(texto).join(" ");
  const pideDur = DURACION.test(t), pidePrecio = PREGUNTA.test(t);
  if (!pideDur && !pidePrecio) return null;
  const q = palabras(texto).filter((w) => w.length >= 3 && !RUIDO.has(w) && !/^\d+$/.test(w));
  if (q.length === 0) return null;
  const servicios = (datos.servicios ?? []).filter((s) => s && typeof s.nombre === "string" && s.nombre.trim());
  const cubre = (nombre: string) => { const ws = palabras(nombre); return q.every((w) => ws.some((x) => calza(w, x))); };
  let cands = servicios.filter((s) => cubre(s.nombre));
  if (cands.length === 0) return null;
  // Los nombres de un solo profesional ("... Nicolas") solo cuentan si el cliente lo nombró.
  const prof = new Set((datos.profesionales ?? []).flatMap((p) => palabras(p.nombre).filter((w) => w.length >= 4)));
  const conProf = (n: string) => palabras(n).some((w) => prof.has(w));
  const sinProf = cands.filter((s) => !conProf(s.nombre));
  if (sinProf.length > 0 && !q.some((w) => prof.has(w))) cands = sinProf;
  // Se quedan los más cercanos a lo pedido (los de nombre más corto): "corte" → "Corte de cabello", no "Corte + Barba + Cejas".
  const NEUTROS = new Set(["cabello", "pelo", "simple", "basico", "normal"]);
  const largo = (s: (typeof cands)[number]) => palabras(s.nombre).filter((w) => w.length >= 3 && !NEUTROS.has(w)).length;
  const menor = Math.min(...cands.map(largo));
  cands = cands.filter((s) => largo(s) <= menor);
  const vistos = new Map<string, (typeof cands)[number]>();
  for (const s of cands) vistos.set(`${palabras(s.nombre).join(" ")}|${pideDur ? s.duracionMin : s.precio}`, s);
  const lista = Array.from(vistos.values());
  if (lista.length === 0 || lista.length > 3) return null;
  if (pideDur) {
    if (lista.some((s) => typeof s.duracionMin !== "number")) return null;
    return `${lista.map((s) => `*${limpio(s.nombre)}*: ${dur(s.duracionMin as number)}`).join("\n")}\n\nEs una duración aproximada.`;
  }
  if (lista.some((s) => typeof s.precio !== "number" || !Number.isFinite(s.precio))) return null;
  // Mismo formato de siempre de la FAQ de precios.
  if (lista.length === 1) return `Precio base de ${limpio(lista[0].nombre)}: $${peso.format(lista[0].precio as number)}. Los profesionales pueden tener precios distintos.`;
  return `Precios base: ${lista.map((s) => `${limpio(s.nombre)}: $${peso.format(s.precio as number)}`).join("; ")}. Los profesionales pueden tener precios distintos.`;
}
