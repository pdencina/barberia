// Reserva por WhatsApp: tras ofrecerle horas al cliente, entiende "quiero la de las 15:15", pide nombre/correo/servicio y deja la hora
// agendada. Determinista, sin IA. La memoria (inyectada) guarda SOLO qué horas se ofrecieron; nunca texto, nombre, correo ni teléfono.
// El nombre, el correo y el servicio se leen del mensaje en memoria y se envían directo a la reserva; si falta algo se vuelve a pedir
// TODO en un solo mensaje, sin guardar datos a medias. La cita se crea con las mismas reglas de la reserva web (inyectada).
import { normalizar, mensajeAdmitido, datoSeguro, type DatosFaq } from "./faq-fija";
import { ahoraChile, textoDeFecha, type Oferta } from "./disponibilidad";

export const VIGENCIA_MIN = 30;
export const MAX_RESERVAS_FUTURAS = 2; // desde aquí se pregunta si quiere otra de todas formas
export const MAX_RESERVAS_TOTAL = 4; // tope duro por número
export const MAX_INTENTOS_DATOS = 4;
const MAX_SERVICIOS_LISTADOS = 8;

export type CampoIndicador = "respuestas_automaticas" | "consultas_disponibilidad" | "ofertas_horas" | "reservas_iniciadas" | "reservas_cerradas" | "derivadas_persona";
/** Lo que el cliente ya fue entregando de a uno (nombre y correo) se guarda solo mientras dura la reserva (VIGENCIA_MIN) y se borra al terminar. */
export interface Seleccion { id: string; nombre: string; duracionMin: number; fecha: string; hora: string; intentos: number; /** Servicio ya elegido (no es un dato personal): se conserva entre mensajes. */ servicioId?: string; cliente?: string; correo?: string }
export type EstadoChat = { etapa: "oferta"; datos: Oferta & { horaPendiente?: string; extraPendiente?: { id: string; nombre: string; duracionMin: number; fecha: string; hora: string } } } | { etapa: "datos"; datos: Seleccion };
export type ResultadoCreacion = { ok: true; citaId: string } | { ok: false; motivo: "ocupada" | "suspendido" | "otro" };
export interface DependenciasReserva {
  ahora: () => number;
  leerEstado: () => Promise<EstadoChat | null>;
  guardarEstado: (e: EstadoChat) => Promise<void>;
  borrarEstado: () => Promise<void>;
  reservasFuturas: (telefono: string) => Promise<number>;
  /** Citas futuras del número (profesional, fecha y hora) para mostrarlas al llegar al tope; opcional. */
  detalleFuturas?: (telefono: string) => Promise<Array<{ profesional: string; fecha: string; hora: string }>>;
  crearReserva: (a: { profesionalId: string; fecha: string; hora: string; servicioId: string; nombre: string; correo: string; telefono: string }) => Promise<ResultadoCreacion>;
  contar: (campo: CampoIndicador) => Promise<void>;
}
/** Lista de WhatsApp para elegir tocando (los ids r1..r8 se traducen a "1".."8"). */
export interface ListaReserva { cuerpo: string; boton: string; filas: Array<{ id: string; title: string; description?: string }> }
export type RespuestaReserva = { texto: string; derivar?: boolean; lista?: ListaReserva } | null;
const recorta = (x: string, n: number) => (x.length > n ? x.slice(0, n - 1).trimEnd() + "…" : x);
const listaProfesionales = (xs: Array<{ nombre: string }>): ListaReserva => ({ cuerpo: "Elige con quién:", boton: "Elegir", filas: xs.slice(0, 8).map((x, i) => ({ id: `r${i + 1}`, title: recorta(x.nombre.trim().split(" ").slice(0, 2).join(" "), 24) })) });
const listaServicios = (xs: Array<{ nombre: string; precio: number | null }>): ListaReserva => ({ cuerpo: "Elige tu servicio:", boton: "Elegir", filas: xs.slice(0, 8).map((x, i) => ({ id: `r${i + 1}`, title: recorta(x.nombre, 24), ...(typeof x.precio === "number" ? { description: `$${moneda.format(x.precio)}` } : {}) })) });

const NEGATIVO = /^(?:no|nop|nel|ya no|no gracias|gracias no|cancelar|cancelo|cancela|olvidalo|dejalo|deja|mejor no|nada)\b/;
const AFIRMATIVO = /^(?:si|dale|ok|okey|ya|listo|perfecto|esa|esa misma|me sirve|me interesa|la quiero|quiero esa|quiero agendar|agendala|agendame|agendame esa|reservala|reservame|confirmo|confirmado|confirmar|vale|claro|sii+|de acuerdo|quiero reservar|reservar|agendar|agendarme)\b/;
const PARECE_CONSULTA = /\?|\b(tiene|tienen|hay|queda|quedan|disponible|disponibles|mañana|hoy|pasado|lunes|martes|miercoles|jueves|viernes|sabado|domingo)\b/;
const CARACTERES = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9\s.,;:@'’\-_+()/#]{1,200}$/;
const CORREO = /[^\s@,;<>()]+@[^\s@,;<>()]+\.[^\s@,;<>()]{2,}/;
const mayusculas = (n: string) => n.split(" ").filter(Boolean).map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
const moneda = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 0 });

// Hora que menciona el cliente: h, minutos y am/pm si los dice. Sin am/pm se compara por reloj de 12 horas contra las horas ofrecidas.
function horaMencionada(t: string): { h: number; m: number; mer: "am" | "pm" | null } | null {
  const c = /\b(\d{1,2}):(\d{2})\s*(am|pm)?\b/.exec(t);
  if (c) return validar(Number(c[1]), Number(c[2]), (c[3] as "am" | "pm" | undefined) ?? null);
  const d = /\b(\d{1,2})\s*(am|pm)\b/.exec(t);
  if (d) return validar(Number(d[1]), 0, d[2] as "am" | "pm");
  const e = /\b(?:las?|de las?|a las?|para las?)\s+(\d{1,2})\b/.exec(t) ?? /^\s*(\d{1,2})\s*(?:por favor|porfa|pls)?\s*$/.exec(t);
  if (e) return validar(Number(e[1]), 0, null);
  return null;
}
function validar(h: number, m: number, mer: "am" | "pm" | null) { return h >= 0 && h <= 23 && m >= 0 && m <= 59 ? { h, m, mer } : null; }
function coincideHora(hora: string, q: { h: number; m: number; mer: "am" | "pm" | null }): boolean {
  const H = Number(hora.slice(0, 2)), M = Number(hora.slice(3, 5));
  if (M !== q.m || H % 12 !== q.h % 12) return false;
  if (q.h > 12 || q.h === 0) return H === q.h; // pidió en reloj de 24 horas
  if (q.mer === "pm") return H >= 12;
  if (q.mer === "am") return H < 12;
  return true;
}
function nombreMencionado(t: string, nombre: string): boolean {
  const palabras = Array.from(new Set(t.split(/[^a-zñ0-9]+/).filter((w) => w.length >= 3)));
  return normalizar(nombre).split(" ").filter((x) => x.length >= 3).some((tok) => palabras.some((w) => w === tok || (w.length >= 4 && tok.startsWith(w))));
}

const MAX_SERVICIOS_MOSTRADOS = 6;
/** Servicios que se pueden elegir: sin repetidos (mismo nombre y precio) y sin los de otro profesional ("... Nicolás" si agenda con otra persona).
 *  Primero los cortes básicos (lo que casi todos piden), de menor a mayor precio. */
export function serviciosElegibles(datos: DatosFaq | null, profesional: string): Array<{ id?: string; nombre: string; precio: number | null }> {
  const propio = normalizar(profesional), otros = new Set<string>();
  for (const p of datos?.profesionales ?? []) for (const w of normalizar(p.nombre).split(" ")) if (w.length >= 4 && !propio.includes(w)) otros.add(w);
  const vistos = new Set<string>(); const salida: Array<{ id?: string; nombre: string; precio: number | null }> = [];
  for (const sv of datos?.servicios ?? []) {
    if (!sv || typeof sv.id !== "string" || !datoSeguro(sv.nombre)) continue;
    const n = normalizar(sv.nombre);
    if (n.split(" ").some((w) => otros.has(w)) || /asesoria/.test(n)) continue;
    const k = `${n}|${sv.precio ?? ""}`; if (vistos.has(k)) continue; vistos.add(k);
    salida.push({ id: sv.id, nombre: sv.nombre.trim(), precio: sv.precio ?? null });
  }
  const rango = (x: { nombre: string }) => { const n = normalizar(x.nombre); return n.startsWith("corte") ? 0 : n.startsWith("ritual") || n.startsWith("arreglo") ? 1 : 2; };
  return salida.sort((a, b) => rango(a) - rango(b) || (a.precio ?? 1e9) - (b.precio ?? 1e9) || a.nombre.localeCompare(b.nombre));
}
/** Los que se le muestran numerados (los demás igual se entienden si los escribe). */
export function serviciosParaListar(datos: DatosFaq | null, profesional: string) { return serviciosElegibles(datos, profesional).slice(0, MAX_SERVICIOS_MOSTRADOS); }

export async function manejarReservaChat(texto: unknown, telefono: string, datos: DatosFaq | null, deps: DependenciasReserva): Promise<RespuestaReserva> {
  const estado = await deps.leerEstado();
  if (!estado) return null;
  if (typeof texto !== "string" || !texto.trim() || texto.length > 200) return null;
  const hoy = ahoraChile(deps.ahora()).fecha;
  const t = normalizar(texto).replace(/\s+/g, " ").trim();

  // Pasa a pedir nombre, correo y servicio para la hora ya elegida.
  const empezarDatos = async (e: { id: string; nombre: string; duracionMin: number; fecha: string; hora: string }, nota?: string): Promise<RespuestaReserva> => {
    const servicios = serviciosParaListar(datos, e.nombre);
    if (servicios.length === 0) { await deps.borrarEstado(); return { texto: "Para dejar tu hora necesito que una persona te ayude con los detalles.", derivar: true }; }
    await deps.guardarEstado({ etapa: "datos", datos: { id: e.id, nombre: e.nombre, duracionMin: e.duracionMin, fecha: e.fecha, hora: e.hora, intentos: 0 } });
    await deps.contar("reservas_iniciadas");
    return { texto: `${nota ? nota + "\n\n" : ""}${pedirDatos(e.nombre, textoDeFecha(e.fecha, hoy), e.hora, servicios)}` };
  };

  if (NEGATIVO.test(t)) {
    await deps.borrarEstado();
    return { texto: "Sin problema, no agendé nada. Si quieres ver otras horas, escríbeme, por ejemplo: «tienen hora mañana»." };
  }

  // ---- 1) el cliente elige una de las horas ofrecidas
  if (estado.etapa === "oferta") {
    // Ya tenía varias horas y se le preguntó si quiere otra de todas formas: un "sí" sigue; un "no" ya se atendió arriba.
    const extra = estado.datos.extraPendiente;
    if (extra) {
      if (!AFIRMATIVO.test(t)) return null;
      if ((await deps.reservasFuturas(telefono)) >= MAX_RESERVAS_TOTAL) {
        await deps.borrarEstado();
        return { texto: `Ya tienes ${MAX_RESERVAS_TOTAL} horas agendadas, que es el máximo por este chat. Para cambiar o cancelar alguna, una persona te ayudará por aquí.`, derivar: true };
      }
      return await empezarDatos(extra);
    }
    const admitido = mensajeAdmitido(texto);
    if (!admitido || PARECE_CONSULTA.test(t)) return null; // otra pregunta (o mensaje no admitido): sigue el camino normal
    const op = estado.datos.opciones;
    const q = horaMencionada(t);
    let elegidas: Array<{ id: string; nombre: string; duracionMin: number; fecha: string; hora: string }> = [];
    // "Busco cerca de las 5" es una búsqueda, no una elección: la responde la consulta de disponibilidad (con las horas más cercanas).
    if (q && /\b(cerca|alrededor|aproximad\w*|mas o menos)\b/.test(t)) return null;
    const pend = estado.datos.horaPendiente;
    const numero = pend ? /^\s*(\d)\s*$/.exec(t) : null;
    if (pend && numero) {
      // Tocó una opción de la lista de profesionales (o escribió su número).
      const cand = op.filter((o) => o.horas.includes(pend));
      const o = cand[Number(numero[1]) - 1];
      if (o) elegidas.push({ id: o.id, nombre: o.nombre, duracionMin: o.duracionMin, fecha: o.fecha, hora: pend });
      else return { texto: `Elige un número del 1 al ${Math.min(cand.length, 8)}, o escríbeme el nombre.`, lista: listaProfesionales(cand) };
    } else if (q) {
      for (const o of op) for (const hora of o.horas) if (coincideHora(hora, q)) elegidas.push({ id: o.id, nombre: o.nombre, duracionMin: o.duracionMin, fecha: o.fecha, hora });
    } else if (estado.datos.horaPendiente) {
      // Dijo una hora que tienen varios profesionales y se le preguntó con quién: ahora basta el nombre.
      for (const o of op) if (o.horas.includes(estado.datos.horaPendiente) && nombreMencionado(t, o.nombre)) elegidas.push({ id: o.id, nombre: o.nombre, duracionMin: o.duracionMin, fecha: o.fecha, hora: estado.datos.horaPendiente });
      if (elegidas.length === 0) {
        const candidatos = op.filter((o) => o.horas.includes(estado.datos.horaPendiente!));
        // "con cualquiera", "el primero", "da lo mismo": se toma el primero. Si no, se repite la pregunta en vez de perder al cliente.
        if (/\b(cualquiera|el primero|la primera|da lo mismo|me da lo mismo|el que sea|con quien sea|con el que (tenga|haya)|el que tenga|el que quede)\b/.test(t) && candidatos.length > 0) { const o = candidatos[0]; elegidas.push({ id: o.id, nombre: o.nombre, duracionMin: o.duracionMin, fecha: o.fecha, hora: estado.datos.horaPendiente }); }
        else if (candidatos.length > 1) return { texto: `Para dejarte la hora de las ${estado.datos.horaPendiente} necesito saber con quién:\n${candidatos.slice(0, 8).map((o, i) => `${i + 1}. ${o.nombre} (${textoDeFecha(o.fecha, hoy)})`).join("\n")}\n\nToca una opción o escríbeme el nombre. Si te da lo mismo, dime «con cualquiera».`, lista: listaProfesionales(candidatos) };
        else return null;
      }
    } else if (op.some((o) => nombreMencionado(t, o.nombre))) {
      // Solo dijo con quién ("con Matías"): si la consulta era por una hora exacta, es esa; si no, se le piden las horas de esa persona.
      const quien = op.filter((o) => nombreMencionado(t, o.nombre));
      const exacta = estado.datos.horaExacta;
      // "Matías en la tarde" / "más tarde": pide un horario, no solo la persona. Lo resuelve la consulta de disponibilidad.
      if (!exacta && /\b(?:en|por|de) la (?:manana|mañana|tarde|noche)\b|\btemprano\b|\bm[aá]s tarde\b/.test(t)) return null;
      for (const o of quien) if (exacta && o.horas.includes(exacta)) elegidas.push({ id: o.id, nombre: o.nombre, duracionMin: o.duracionMin, fecha: o.fecha, hora: exacta });
      if (elegidas.length === 0) {
        const o = quien[0];
        // Se queda solo con esa persona: así un "sí" o "la de las 19:00" ya sabe a quién se refiere.
        await deps.guardarEstado({ etapa: "oferta", datos: { horaExacta: o.horas.length === 1 ? o.horas[0] : null, opciones: [o] } });
        if (o.horas.length === 1) return { texto: `Con *${o.nombre}* ${textoDeFecha(o.fecha, hoy)} tengo *${o.horas[0]}*.\n\n¿Te la agendo? Responde *sí* y te pido tus datos.` };
        return { texto: `Con *${o.nombre}* ${textoDeFecha(o.fecha, hoy)} tengo: ${o.horas.slice(0, 6).join(" · ")}.\n\nEscríbeme la hora que prefieras, por ejemplo: «la de las ${o.horas[0]}».` };
      }
    } else if (AFIRMATIVO.test(t) && op.length === 1 && (estado.datos.horaExacta ? op[0].horas.includes(estado.datos.horaExacta) : op[0].horas.length === 1)) {
      // "sí" cuando solo hay una hora posible (la consultada o la única que tiene esa persona).
      elegidas = [{ id: op[0].id, nombre: op[0].nombre, duracionMin: op[0].duracionMin, fecha: op[0].fecha, hora: estado.datos.horaExacta ?? op[0].horas[0] }];
    } else if (AFIRMATIVO.test(t) && t.split(" ").length <= 3 && op.length > 1) {
      const exacta = estado.datos.horaExacta;
      const quienes = exacta ? op.filter((o) => o.horas.includes(exacta)) : [];
      if (exacta && quienes.length > 0) {
        // Dijo que sí a la hora consultada: se le asigna el primero disponible y se sigue con los datos.
        elegidas = quienes.map((x) => ({ id: x.id, nombre: x.nombre, duracionMin: x.duracionMin, fecha: x.fecha, hora: exacta }));
      } else {
        // Sin hora definida: se le muestran las más cercanas (hora + profesional) para cerrar en un paso.
        const combos = op.flatMap((o) => o.horas.slice(0, 2).map((h) => ({ o, h }))).sort((a, b) => a.h.localeCompare(b.h)).slice(0, 3);
        if (combos.length === 0) return null;
        return { texto: `¡Dale! Elige una y te pido tus datos:\n${combos.map((c) => `• *${c.h}* con ${c.o.nombre.split(" ").slice(0, 2).join(" ")} ${textoDeFecha(c.o.fecha, hoy)}`).join("\n")}\n\nEscríbeme, por ejemplo: «la de las ${combos[0].h}».` };
      }
    } else return null;
    const conNombre = elegidas.filter((e) => nombreMencionado(t, e.nombre));
    if (conNombre.length > 0) elegidas = conNombre;
    const resumen = () => op.slice(0, 4).map((o) => `• *${o.nombre}* ${textoDeFecha(o.fecha, hoy)}: ${o.horas.slice(0, 3).join(" · ")}`).join("\n");
    if (elegidas.length === 0) return { texto: `Esa hora no está entre las que te ofrecí. Estas son las opciones:\n${resumen()}\n\nEscríbeme la hora que prefieras, por ejemplo: «la de las ${op[0].horas[0]}».` };
    if (elegidas.length > 1) {
      // Eligió solo la hora y hay varios profesionales: NO se elige por el cliente; se le muestran para que toque uno.
      const h0 = elegidas[0].hora;
      elegidas = elegidas.filter((x) => x.hora === h0);
    }
    if (elegidas.length > 1) {
      await deps.guardarEstado({ etapa: "oferta", datos: { ...estado.datos, horaPendiente: elegidas[0].hora } });
      return { texto: `A las ${elegidas[0].hora} ${textoDeFecha(elegidas[0].fecha, hoy)} tengo con:\n${elegidas.slice(0, 8).map((x, i) => `${i + 1}. ${x.nombre}`).join("\n")}\n\n¿Con quién te la dejo? Toca una opción o escríbeme el nombre.`, lista: listaProfesionales(elegidas) };
    }
    const e = elegidas[0];
    const futuras = await deps.reservasFuturas(telefono);
    if (futuras >= MAX_RESERVAS_TOTAL) {
      await deps.borrarEstado();
      return { texto: `Ya tienes ${futuras} horas agendadas, que es el máximo por este chat. Para cambiar o cancelar alguna, una persona te ayudará por aquí.`, derivar: true };
    }
    if (futuras >= MAX_RESERVAS_FUTURAS) {
      // En vez de bloquear: se muestran sus horas y decide. Se guarda la elegida para seguir con un "sí".
      let detalle: Array<{ profesional: string; fecha: string; hora: string }> = [];
      try { detalle = (await deps.detalleFuturas?.(telefono)) ?? []; } catch { /* sin detalle: igual se le pregunta */ }
      const lista = detalle.length ? `:\n${detalle.slice(0, 5).map((d) => `• *${d.profesional}* ${textoDeFecha(d.fecha, hoy)} a las ${d.hora}`).join("\n")}` : ".";
      await deps.guardarEstado({ etapa: "oferta", datos: { ...estado.datos, extraPendiente: e } });
      return { texto: `Ya tienes ${futuras} horas agendadas${lista}\n\n¿Quieres agendar otra de todas formas? Responde *sí* o *no*.\nSi prefieres cambiar o cancelar alguna, escríbenos y una persona te ayudará.` };
    }
    return await empezarDatos(e);
  }

  // ---- 2) el cliente envía sus datos
  const sel = estado.datos;
  // Una pregunta nueva ("¿tienen hora a las 5:30?") sin correo no son sus datos: sigue el camino normal.
  if (!CORREO.test(texto) && PARECE_CONSULTA.test(t)) return null;
  if (!CARACTERES.test(texto)) return faltan(sel, deps, "Para confirmar necesito tus datos en texto simple.");
  const todosServicios = serviciosElegibles(datos, sel.nombre), servicios = todosServicios.slice(0, MAX_SERVICIOS_MOSTRADOS);
  if (servicios.length === 0) { await deps.borrarEstado(); return { texto: "Para dejar tu hora necesito que una persona te ayude con los detalles.", derivar: true }; }
  // Solo un "sí", "ok" o "dale": no son datos ni un intento fallido; se le recuerda qué falta.
  if (AFIRMATIVO.test(t) && t.split(" ").length <= 3 && !CORREO.test(texto)) return await siguientePaso(sel, true, servicios, deps);
  const correoM = CORREO.exec(texto);
  const correoNuevo = correoM ? correoM[0].toLowerCase() : null;
  let resto = correoM ? texto.replace(correoM[0], " ") : texto;
  let servicio = todosServicios.length === 1 ? todosServicios[0] : (sel.servicioId ? todosServicios.find((x) => x.id === sel.servicioId) ?? null : null);
  if (!servicio) {
    const num = /(?:^|[\s,;])(\d{1,2})(?=$|[\s,;.)])/.exec(resto);
    if (num && Number(num[1]) >= 1 && Number(num[1]) <= servicios.length) { servicio = servicios[Number(num[1]) - 1]; resto = resto.replace(num[0], " "); }
    else {
      const porNombre = todosServicios.filter((s) => normalizar(texto).includes(normalizar(s.nombre)));
      if (porNombre.length === 1) { servicio = porNombre[0]; resto = resto.replace(new RegExp(porNombre[0].nombre.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), " "); }
      else if (porNombre.length === 0) {
        // Escribió el servicio con sus palabras ("corte de cabello"): sirve si calza con uno solo (un mismo nombre con precios distintos cuenta como varios).
        const q = normalizar(texto.replace(correoM ? correoM[0] : "", " ")).replace(/[,;:.()#/_+@]+/g, " ").replace(/\s+/g, " ").trim();
        if (q.length >= 4) { const cand = todosServicios.filter((x) => normalizar(x.nombre) === q || normalizar(x.nombre).startsWith(q + " ") || normalizar(x.nombre).includes(` ${q} `) ); if (cand.length === 1) { servicio = cand[0]; resto = " "; } }
      }
    }
  }
  const pareceEnlace = /:\/\/|www\.|[A-Za-z0-9]\.[A-Za-z]{2,}/.test(resto);
  const limpio = pareceEnlace ? "" : resto.replace(/[,;:.()#/_+@\d]+/g, " ").replace(/\s+/g, " ").trim();
  const palabras = limpio.split(" ").filter(Boolean);
  const nombreOk = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ'’\- ]{4,60}$/.test(limpio) && palabras.length >= 2 && palabras.length <= 6 && palabras.every((w) => /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(w));
  // Los datos se van juntando de a uno: lo nuevo se suma a lo que ya se había dado, y se pide solo lo que falta.
  const nombreNuevo = nombreOk ? mayusculas(limpio) : null;
  const nombre = nombreNuevo ?? sel.cliente ?? null;
  const correo = correoNuevo ?? sel.correo ?? null;
  if (!nombre || !correo || !servicio) {
    const progreso = (!!nombreNuevo && nombreNuevo !== sel.cliente) || (!!correoNuevo && correoNuevo !== sel.correo) || (!!servicio && servicio.id !== sel.servicioId);
    return await siguientePaso({ ...sel, ...(nombre ? { cliente: nombre } : {}), ...(correo ? { correo } : {}), ...(servicio?.id ? { servicioId: servicio.id } : {}) }, progreso, servicios, deps);
  }
  const r = await deps.crearReserva({ profesionalId: sel.id, fecha: sel.fecha, hora: sel.hora, servicioId: servicio.id!, nombre, correo, telefono });
  await deps.borrarEstado();
  if (r.ok) {
    await deps.contar("reservas_cerradas");
    return { texto: `¡Listo, ${nombre.split(" ")[0]}! Tu hora quedó agendada:\n\n• *${sel.nombre}*\n• ${textoDeFecha(sel.fecha, hoy)} a las *${sel.hora}*\n• ${servicio.nombre}\n\nTe enviamos el detalle a tu correo. Si necesitas cambiarla, escríbenos por aquí.` };
  }
  if (r.motivo === "ocupada") return { texto: "Esa hora se acaba de ocupar. Escríbeme y te muestro otras, por ejemplo: «tienen hora mañana»." };
  return { texto: "No pude dejar tu hora. Una persona te ayudará por aquí en breve.", derivar: true };
}

async function faltan(sel: Seleccion, deps: DependenciasReserva, texto: string): Promise<RespuestaReserva> {
  if (sel.intentos + 1 >= MAX_INTENTOS_DATOS) {
    await deps.borrarEstado();
    return { texto: "No logré entender tus datos. Una persona te ayudará a dejar tu hora.", derivar: true };
  }
  await deps.guardarEstado({ etapa: "datos", datos: { ...sel, intentos: sel.intentos + 1 } });
  return { texto };
}
const unirFaltas = (a: string[]) => (a.length <= 1 ? a.join("") : `${a.slice(0, -1).join(", ")} y ${a[a.length - 1]}`);
function ejemplo(servicios: Array<{ nombre: string }>): string {
  const ej = servicios.length > 1 ? "Envíamelo todo junto en un solo mensaje, por ejemplo:\nJuan Pérez, juan@correo.cl, 1" : "Envíamelo todo en un solo mensaje, por ejemplo:\nJuan Pérez, juan@correo.cl";
  return `${ej}\n\nEscribe *menú* para volver al inicio.`;
}
function pedirDatos(profesional: string, dia: string, hora: string, servicios: Array<{ nombre: string; precio: number | null }>): string {
  return `Perfecto. Te dejo la hora con *${profesional}* ${dia} a las *${hora}*.\n\nPara confirmarla, ¿cuál es tu nombre completo?\n(Si prefieres, mándame todo junto: nombre, correo${servicios.length > 1 ? " y servicio" : ""}.)\n\nEscribe *menú* para volver al inicio.`;
}

/** Pide solo lo que falta, de a uno: nombre, luego correo, luego servicio (con lista para tocar). Los datos ya dados quedan en la memoria de la reserva. */
async function siguientePaso(sel: Seleccion, progreso: boolean, servicios: Array<{ nombre: string; precio: number | null }>, deps: DependenciasReserva): Promise<RespuestaReserva> {
  const intentos = progreso ? sel.intentos : sel.intentos + 1;
  if (intentos >= MAX_INTENTOS_DATOS) {
    await deps.borrarEstado();
    return { texto: "No logré entender tus datos. Una persona te ayudará a dejar tu hora.", derivar: true };
  }
  await deps.guardarEstado({ etapa: "datos", datos: { ...sel, intentos } });
  const primer = sel.cliente ? sel.cliente.split(" ")[0] : "";
  if (!sel.cliente) return { texto: progreso ? "Me falta tu nombre completo. ¿Cómo te llamas? (nombre y apellido)" : "No alcancé a entender tu nombre. ¿Me lo escribes completo? (nombre y apellido)" };
  if (!sel.correo) return { texto: `Gracias, ${primer}. ¿Cuál es tu correo? Ahí te llega el detalle de tu hora.` };
  const filas = servicios.slice(0, 8);
  return { texto: `Último paso, ${primer}: ¿qué servicio quieres?\n${filas.map((s, i) => `${i + 1}. ${s.nombre}${typeof s.precio === "number" ? ` ($${moneda.format(s.precio)})` : ""}`).join("\n")}\n\nToca una opción o escríbeme el número.`, lista: listaServicios(filas) };
}
