import { CATALOGO, type EntradaOti } from "./catalogo";
import { norm } from "./texto";

export interface ResultadoBusqueda { entrada: EntradaOti; puntaje: number }

const PALABRAS_VACIAS = new Set(["de", "del", "la", "el", "los", "las", "un", "una", "y", "o", "a", "en", "que", "como", "me", "mi", "mis", "se", "por", "para", "con", "al", "lo", "es", "puedo", "quiero", "necesito", "hacer", "donde"]);
// Raiz simple: se quitan las terminaciones mas comunes del español (ar, er, ir, o, a, os, as, es, ando...) y se dejan las 5 primeras letras, para que «cambio»,
// «cambiar» y «cambiando» (o «servicio» y «servicios») cuenten como la misma palabra. Las formas irregulares («devuelvo», «cierro») van en VERBOS.
const raiz = (t: string) => {
  const sin = t.replace(/(?:ando|iendo|aron|ieron|amos|emos|imos|ar|er|ir|an|en|as|es|os|o|a|e)$/, "");
  const base = sin.length >= 3 ? sin : t;
  return base.length > 5 ? base.slice(0, 5) : base;
};
// Formas de verbos que no se parecen a su infinitivo (o muy usadas en primera persona): se llevan al infinitivo antes de sacar la raiz.
const VERBOS: Record<string, string> = {
  devuelvo: "devolver", devuelve: "devolver", cierro: "cerrar", cierra: "cerrar", cierre: "cerrar", abro: "abrir", mando: "enviar", mandar: "enviar", envio: "enviar", mandan: "enviar",
  pongo: "poner", pido: "pedir", anoto: "anotar", cobro: "cobrar", pago: "pagar", vuelvo: "volver", edito: "cambiar", saco: "sacar", veo: "ver", agrego: "agregar", sumo: "agregar",
  subo: "subir", bajo: "bajar", borro: "borrar", elimino: "borrar", quito: "borrar", encuentro: "encontrar", tengo: "tener", puedo: "poder", recibo: "recibir", muestro: "mostrar",
  cuento: "contar", recuerdo: "recordar", llega: "llegar", llegan: "llegar", llegó: "llegar", vienen: "venir", vino: "venir", llego: "llegar",
};
// Como habla la gente: palabras distintas para lo mismo se tratan como una sola (en lo que escribe y en las frases del catalogo).
const SINONIMOS: Record<string, string> = {
  barbero: "profesional", barbera: "profesional", peluquero: "profesional", peluquera: "profesional", estilista: "profesional", colaborador: "profesional", trabajador: "profesional", empleado: "profesional",
  plata: "dinero", lucas: "dinero", guita: "dinero", platita: "dinero",
  anticipo: "abono", senal: "abono", adelanto: "abono",
  password: "contrasena", clave: "contrasena", pin: "contrasena",
  ingresar: "entrar", loguear: "entrar", logear: "entrar", acceder: "entrar",
  reservar: "agendar", reserva: "agendar", reservas: "agendar", citar: "agendar", agendo: "agendar",
  anular: "cancelar", suspender: "cancelar", eliminar: "borrar", quitar: "borrar",
  modificar: "cambiar", editar: "cambiar", actualizar: "cambiar", corregir: "cambiar",
  tarjeta: "tarjeta", redcompra: "tarjeta", maquinita: "tarjeta", transbank: "tarjeta",
  descuento: "cupon", promocion: "cupon", promo: "cupon",
  duracion: "tiempo", demora: "tiempo", dura: "tiempo", minutos: "tiempo",
  celular: "movil", telefono: "movil", iphone: "movil", android: "movil",
  almuerzo: "colacion", descanso: "colacion",
  mail: "correo", email: "correo", correos: "correo", mails: "correo", gente: "cliente", salon: "negocio", barberia: "negocio", local: "negocio", viaje: "vacaciones", regalo: "premio", regalar: "premio", pedido: "pedir",
  creo: "crear", creamos: "crear", crea: "crear", hago: "hacer", hacer: "hacer", armo: "crear", armar: "crear", configuro: "configurar", configurar: "configurar", configuracion: "configurar",
};
const tokens = (s: string) => norm(s).split(" ").filter((t) => t.length > 1 && !PALABRAS_VACIAS.has(t)).map((t) => raiz(SINONIMOS[VERBOS[t] ?? t] ?? VERBOS[t] ?? t));

// Busqueda sin IA: una frase clave contenida en lo que escribio vale mucho; si no, palabras en comun. Si nada alcanza el umbral, devuelve [] (Oti dira "no lo se").
// ---- Busqueda por texto completo (para preguntas que no calzan con ninguna frase clave) ----
// Cada entrada se indexa con todo su texto (titulo, resumen, pasos y frases). Una palabra poco comun vale mas que una comun (IDF).
interface IndiceEntrada { tokens: Set<string> }
const cacheIndice = new WeakMap<EntradaOti[], { filas: IndiceEntrada[]; idf: Map<string, number> }>();
function indiceDe(catalogo: EntradaOti[]) {
  let c = cacheIndice.get(catalogo);
  if (c) return c;
  const filas: IndiceEntrada[] = catalogo.map((e) => ({ tokens: new Set(tokens([e.titulo, e.resumen, ...(e.pasos || []), ...e.claves].join(" "))) }));
  const df = new Map<string, number>();
  for (const f of filas) f.tokens.forEach((t) => df.set(t, (df.get(t) || 0) + 1));
  const idf = new Map<string, number>();
  df.forEach((n, t) => idf.set(t, Math.log(1 + catalogo.length / n)));
  c = { filas, idf };
  cacheIndice.set(catalogo, c);
  return c;
}
// Puntaje 0 a 9: solo cuenta si calzan varias palabras y buena parte de lo que se pregunto (nunca le gana a una frase clave).
function puntajeTexto(qt: Set<string>, fila: IndiceEntrada, idf: Map<string, number>): number {
  if (qt.size < 2) return 0;
  let comunes = 0, suma = 0, total = 0;
  qt.forEach((t) => { const w = idf.get(t) ?? 0; total += w; if (fila.tokens.has(t)) { comunes++; suma += w; } });
  if (comunes < 2 || total === 0 || comunes / qt.size <= 0.5) return 0; // más de la mitad de las palabras de la pregunta deben calzar
  const fraccion = suma / total;
  return fraccion >= 0.6 ? Math.min(9, Math.round(4 + fraccion * 5)) : 0;
}

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
      if (` ${q} `.includes(` ${c} `)) {
        const palabras = c.split(" ").length;
        // Una clave de UNA sola palabra («clientes», «caja») dentro de una pregunta larga dice poco: no le gana a una coincidencia de varias palabras.
        puntaje = Math.max(puntaje, palabras === 1 && qt.size >= 4 ? 7 : 10 + palabras * 3);
      }
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
    if (norm(entrada.titulo) === q) puntaje = Math.max(puntaje, 40); // escribio el titulo exacto de la entrada
    // Las guias de tareas («como hago X») son mas especificas que una pantalla: ganan los empates cercanos.
    if (puntaje >= 6 && (entrada.id.startsWith("t-") || entrada.id.startsWith("k-"))) puntaje += 4; // solo si la coincidencia ya es buena
    if (puntaje >= minimo) out.push({ entrada, puntaje });
    else if (minimo <= 8) {
      // Sin frase clave: se busca en el texto completo de la entrada.
      const { filas, idf } = indiceDe(catalogo);
      const f = filas[catalogo.indexOf(entrada)];
      const pt = f ? puntajeTexto(qt, f, idf) : 0;
      if (pt >= minimo) out.push({ entrada, puntaje: pt });
    }
  }
  return out.sort((a, b) => b.puntaje - a.puntaje).slice(0, max);
}
