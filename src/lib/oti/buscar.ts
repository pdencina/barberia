import { CATALOGO, type EntradaOti } from "./catalogo";
import { norm } from "./texto";

export interface ResultadoBusqueda { entrada: EntradaOti; puntaje: number }

const PALABRAS_VACIAS = new Set(["de", "del", "la", "el", "los", "las", "un", "una", "y", "o", "a", "en", "que", "como", "me", "mi", "mis", "se", "por", "para", "con", "al", "lo", "es", "puedo", "quiero", "necesito", "hacer", "donde"]);
// Raiz simple: las 5 primeras letras, para que «cambio», «cambiar» y «cambiando» (o «servicio» y «servicios») cuenten como la misma palabra.
const raiz = (t: string) => (t.length > 5 ? t.slice(0, 5) : t);
const tokens = (s: string) => norm(s).split(" ").filter((t) => t.length > 1 && !PALABRAS_VACIAS.has(t)).map(raiz);

// Busqueda sin IA: una frase clave contenida en lo que escribio vale mucho; si no, palabras en comun. Si nada alcanza el umbral, devuelve [] (Oti dira "no lo se").
export function buscarAyuda(pregunta: string, catalogo: EntradaOti[] = CATALOGO, max = 3): ResultadoBusqueda[] {
  const q = norm(pregunta);
  if (q.length < 2) return [];
  const qt = new Set(tokens(q));
  const out: ResultadoBusqueda[] = [];
  for (const entrada of catalogo) {
    let puntaje = 0;
    for (const clave of entrada.claves) {
      const c = norm(clave);
      if (!c) continue;
      if (` ${q} `.includes(` ${c} `)) puntaje = Math.max(puntaje, 10 + c.split(" ").length * 3);
      else {
        const ct = tokens(c);
        const comunes = ct.filter((t) => qt.has(t)).length;
        if (ct.length > 0 && comunes === ct.length) puntaje = Math.max(puntaje, 8 + ct.length); // todas las palabras de la clave, en otro orden
        else if (comunes >= 2) puntaje = Math.max(puntaje, comunes * 2);
      }
    }
    // El titulo tambien cuenta (poco).
    const tt = tokens(entrada.titulo);
    const enTitulo = tt.filter((t) => qt.has(t)).length;
    if (enTitulo >= 2) puntaje = Math.max(puntaje, enTitulo * 2);
    if (puntaje >= 6) out.push({ entrada, puntaje });
  }
  return out.sort((a, b) => b.puntaje - a.puntaje).slice(0, max);
}
