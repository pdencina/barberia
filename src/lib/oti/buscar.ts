import { CATALOGO, type EntradaOti } from "./catalogo";
import { norm } from "./texto";

export interface ResultadoBusqueda { entrada: EntradaOti; puntaje: number }

const PALABRAS_VACIAS = new Set(["de", "del", "la", "el", "los", "las", "un", "una", "y", "o", "a", "en", "que", "como", "me", "mi", "mis", "se", "por", "para", "con", "al", "lo", "es", "puedo", "quiero", "necesito", "hacer", "donde"]);
// Raiz simple: las 5 primeras letras, para que «cambio», «cambiar» y «cambiando» (o «servicio» y «servicios») cuenten como la misma palabra.
const raiz = (t: string) => (t.length > 5 ? t.slice(0, 5) : t);
// Como habla la gente: palabras distintas para lo mismo se tratan como una sola (en lo que escribe y en las frases del catalogo).
const SINONIMOS: Record<string, string> = {
  barbero: "profesional", barbera: "profesional", peluquero: "profesional", peluquera: "profesional", estilista: "profesional", colaborador: "profesional", trabajador: "profesional", empleado: "profesional",
  plata: "dinero", lucas: "dinero", guita: "dinero", platita: "dinero",
  anticipo: "abono", senal: "abono", adelanto: "abono",
  password: "contrasena", clave: "contrasena", pin: "contrasena",
  ingresar: "entrar", loguear: "entrar", logear: "entrar", acceder: "entrar",
  reservar: "agendar", reserva: "agendar", reservas: "agendar", citar: "agendar", agendo: "agendar",
  anular: "cancelar", suspender: "cancelar", eliminar: "borrar", quitar: "borrar", sacar: "borrar",
  modificar: "cambiar", editar: "cambiar", actualizar: "cambiar", corregir: "cambiar",
  tarjeta: "tarjeta", redcompra: "tarjeta", maquinita: "tarjeta", transbank: "tarjeta",
  descuento: "cupon", promocion: "cupon", promo: "cupon",
  duracion: "tiempo", demora: "tiempo", dura: "tiempo", minutos: "tiempo",
  celular: "movil", telefono: "movil", iphone: "movil", android: "movil",
  almuerzo: "colacion", descanso: "colacion",
};
const tokens = (s: string) => norm(s).split(" ").filter((t) => t.length > 1 && !PALABRAS_VACIAS.has(t)).map((t) => raiz(SINONIMOS[t] ?? t));

// Busqueda sin IA: una frase clave contenida en lo que escribio vale mucho; si no, palabras en comun. Si nada alcanza el umbral, devuelve [] (Oti dira "no lo se").
export function buscarAyuda(pregunta: string, catalogo: EntradaOti[] = CATALOGO, max = 3, minimo = 6): ResultadoBusqueda[] {
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
        else if (comunes === 1 && minimo <= 2) puntaje = Math.max(puntaje, 2); // solo para sugerir opciones
      }
    }
    // El titulo tambien cuenta (poco).
    const tt = tokens(entrada.titulo);
    const enTitulo = tt.filter((t) => qt.has(t)).length;
    if (enTitulo >= 2) puntaje = Math.max(puntaje, enTitulo * 2);
    else if (enTitulo === 1 && minimo <= 2) puntaje = Math.max(puntaje, 2);
    // Las guias de tareas («como hago X») son mas especificas que una pantalla: ganan los empates cercanos.
    if (puntaje > 0 && entrada.id.startsWith("t-")) puntaje += 4;
    if (puntaje >= minimo) out.push({ entrada, puntaje });
  }
  return out.sort((a, b) => b.puntaje - a.puntaje).slice(0, max);
}
