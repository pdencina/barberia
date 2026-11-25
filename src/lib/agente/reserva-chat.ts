// Reserva por WhatsApp: tras ofrecerle horas al cliente, entiende "quiero la de las 15:15", pide nombre/correo/servicio y deja la hora
// agendada. Determinista, sin IA. La memoria (inyectada) guarda SOLO qué horas se ofrecieron; nunca texto, nombre, correo ni teléfono.
// El nombre, el correo y el servicio se leen del mensaje en memoria y se envían directo a la reserva; si falta algo se vuelve a pedir
// TODO en un solo mensaje, sin guardar datos a medias. La cita se crea con las mismas reglas de la reserva web (inyectada).
import { normalizar, mensajeAdmitido, datoSeguro, type DatosFaq } from "./faq-fija";
import { ahoraChile, textoDeFecha, type Oferta } from "./disponibilidad";
import { palabraCalza } from "./nombres";
import { sonido } from "./servicio-profesional";
import { textoDeAbono } from "./abono";
// Para nombres de servicio no vale el parecido por distancia ("rizos" ≠ "visos"): solo igual, mismo sonido o prefijo de 4+ letras.
const servCalza = (w: string, tok: string) => { const a = sonido(w), b = sonido(tok); return a === b || (Math.min(a.length, b.length) >= 4 && (a.startsWith(b) || b.startsWith(a))); };

export const VIGENCIA_MIN = 30;
export const MAX_RESERVAS_FUTURAS = 2; // desde aquí se pregunta si quiere otra de todas formas
export const MAX_RESERVAS_TOTAL = 4; // tope duro por número
export const MAX_INTENTOS_DATOS = 4;
const MAX_SERVICIOS_LISTADOS = 8;

export type CampoIndicador = "respuestas_automaticas" | "consultas_disponibilidad" | "ofertas_horas" | "reservas_iniciadas" | "reservas_cerradas" | "derivadas_persona";
/** Lo que el cliente ya fue entregando de a uno (nombre y correo) se guarda solo mientras dura la reserva (VIGENCIA_MIN) y se borra al terminar. */
export interface Seleccion { id: string; nombre: string; duracionMin: number; fecha: string; hora: string; intentos: number; /** Servicio ya elegido (no es un dato personal): se conserva entre mensajes. */ servicioId?: string; cliente?: string; correo?: string; /** Servicios ya acotados ("corte más barba" calza con varios): el número elegido se lee contra esta lista. */ opcionesServicio?: string[] }
export type EstadoChat = { etapa: "oferta"; datos: Oferta & { horaPendiente?: string; extraPendiente?: { id: string; nombre: string; duracionMin: number; fecha: string; hora: string } } } | { etapa: "datos"; datos: Seleccion };
export type ResultadoCreacion = { ok: true; citaId: string; /** Código de reserva del cliente (el que se muestra en el calendario y sirve para el check-in) */ codigo?: string | null } | { ok: false; motivo: "ocupada" | "suspendido" | "otro" | "no_cabe" };
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
  /** Si el cliente está cambiando su cita ("Modificar mi cita"): sus datos ya conocidos, para agendar la nueva sin pedírselos otra vez. */
  precargado?: () => Promise<{ cliente: string; correo: string; servicioId: string } | null>;
  /** Se llama con la cita nueva ya creada: cancela la anterior. */
  alReprogramar?: (citaNuevaId: string) => Promise<void>;
  /** Avisa al equipo que hay una hora esperando abono (para que la agenden al recibir el comprobante). */
  avisarAbono?: (resumen: string) => Promise<void>;
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
/** Cuántas palabras del nombre aparecen en el mensaje ("dylan perez" calza 2 con Dylan Perez y 1 con Enzo Perez). */
function puntajeNombre(t: string, nombre: string): number {
  const palabras = Array.from(new Set(t.split(/[^a-zñ0-9]+/).filter((w) => w.length >= 3)));
  return normalizar(nombre).split(" ").filter((x) => x.length >= 3).filter((tok) => palabras.some((w) => palabraCalza(w, tok))).length;
}
function nombreMencionado(t: string, nombre: string): boolean { return puntajeNombre(t, nombre) > 0; }
/** Los que mejor calzan con lo escrito: si dos comparten un apellido, gana quien calza con nombre y apellido. */
/** Si el cliente nombró a UN profesional de la oferta y ese profesional NO tiene la hora pedida: no se le deja la hora a otra persona. */
function nombradoSinEsaHora<T extends { nombre: string; horas: string[] }>(t: string, op: T[], tieneHora: (h: string) => boolean): T | null {
  if (!op.some((o) => nombreMencionado(t, o.nombre))) return null;
  const m = mejoresCoincidencias(t, op);
  return m.length === 1 && !m[0].horas.some(tieneHora) ? m[0] : null;
}
function mejoresCoincidencias<T extends { nombre: string }>(t: string, xs: T[]): T[] {
  const p = xs.map((x) => puntajeNombre(t, x.nombre)), max = Math.max(0, ...p);
  return max > 0 ? xs.filter((_, i) => p[i] === max) : [];
}

const MAX_SERVICIOS_MOSTRADOS = 6;
/** Servicios que se pueden elegir: sin repetidos (mismo nombre y precio) y sin los de otro profesional ("... Nicolás" si agenda con otra persona).
 *  Primero los cortes básicos (lo que casi todos piden), de menor a mayor precio. */
export function serviciosElegibles(datos: DatosFaq | null, profesional: string): Array<{ id?: string; nombre: string; precio: number | null }> {
  const propio = normalizar(profesional), otros = new Set<string>();
  for (const p of datos?.profesionales ?? []) for (const w of normalizar(p.nombre).split(" ")) if (w.length >= 4 && !propio.includes(w)) otros.add(w);
  const vistos = new Set<string>(); const salida: Array<{ id?: string; nombre: string; precio: number | null }> = [];
  // Profesionales > Servicios: solo lo que ese profesional hace (sin nada marcado, hace todo).
  const hace = (datos?.profesionales ?? []).find((p) => normalizar(p.nombre) === propio)?.serviciosIds;
  for (const sv of datos?.servicios ?? []) {
    if (!sv || typeof sv.id !== "string" || !datoSeguro(sv.nombre)) continue;
    if (Array.isArray(hace) && !hace.includes(sv.id)) continue;
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

  // Servicio que se reserva con abono (rizos, visos, color...): no se agenda solo; se dan los datos y se avisa al equipo.
  const pedirAbono = async (servicio: string, abono: string, profesional: string, fecha: string, hora: string): Promise<RespuestaReserva> => {
    await deps.borrarEstado();
    const cuando = `${textoDeFecha(fecha, hoy)} a las ${hora}`;
    try { await deps.avisarAbono?.(`Hora esperando abono: ${servicio} con ${profesional}, ${cuando} (${fecha}).`); } catch { /* el aviso es un extra: el cliente igual recibe los datos */ }
    return { texto: `*${servicio}* con *${profesional}* ${textoDeFecha(fecha, hoy)} a las *${hora}* se reserva con abono.\n\n${abono}\n\n*Tu hora todavía no está agendada.* Cuando transfieras, envía el comprobante por este chat con tu nombre completo: el equipo lo revisa y te confirma.` };
  };

  // Pasa a pedir nombre, correo y servicio para la hora ya elegida.
  const empezarDatos = async (e: { id: string; nombre: string; duracionMin: number; fecha: string; hora: string }, nota?: string): Promise<RespuestaReserva> => {
    // Cambio de hora: ya se conocen nombre, correo y servicio de la cita anterior; se agenda de inmediato y se cancela la anterior.
    let pre: Awaited<ReturnType<NonNullable<DependenciasReserva["precargado"]>>> = null;
    try { pre = deps.precargado ? await deps.precargado() : null; } catch { pre = null; }
    if (pre) {
      const sv = serviciosElegibles(datos, e.nombre).find((x) => x.id === pre!.servicioId);
      if (sv) {
        const r = await deps.crearReserva({ profesionalId: e.id, fecha: e.fecha, hora: e.hora, servicioId: sv.id!, nombre: pre.cliente, correo: pre.correo, telefono });
        await deps.borrarEstado();
        if (r.ok) {
          await deps.contar("reservas_cerradas");
          try { await deps.alReprogramar?.(r.citaId); } catch { /* la nueva ya quedó: la anterior la ve una persona */ }
          return { texto: `¡Listo, ${pre.cliente.split(" ")[0]}! Cambié tu hora:\n\n• *${e.nombre}*\n• ${textoDeFecha(e.fecha, hoy)} a las *${e.hora}*\n• ${sv.nombre}${lineaCodigo(r.codigo)}\n\nTu hora anterior quedó cancelada. Recomendamos llegar unos minutos antes. ¡Te esperamos!` };
        }
        if (r.motivo === "ocupada") return { texto: "Esa hora se acaba de ocupar. Escríbeme y te muestro otras, por ejemplo: «tienen hora mañana»." };
        return { texto: "No pude cambiar tu hora. Una persona te ayudará por aquí en breve.", derivar: true };
      }
    }
    let servicios = serviciosParaListar(datos, e.nombre);
    if (servicios.length === 0) { await deps.borrarEstado(); return { texto: "Para dejar tu hora necesito que una persona te ayude con los detalles.", derivar: true }; }
    // Si el cliente ya dijo qué servicio quería ("rizos"), se conserva: no se le vuelve a preguntar.
    const pedido = estado.etapa === "oferta" ? estado.datos.servicioId : undefined;
    const elegido = pedido ? serviciosElegibles(datos, e.nombre).find((x) => x.id === pedido) : undefined;
    if (elegido) servicios = [elegido];
    const abono = elegido ? textoDeAbono(elegido.nombre, datos) : null;
    if (elegido && abono) return await pedirAbono(elegido.nombre, abono, e.nombre, e.fecha, e.hora);
    await deps.guardarEstado({ etapa: "datos", datos: { id: e.id, nombre: e.nombre, duracionMin: e.duracionMin, fecha: e.fecha, hora: e.hora, intentos: 0, ...(elegido?.id ? { servicioId: elegido.id } : {}) } });
    await deps.contar("reservas_iniciadas");
    return { texto: `${nota ? nota + "\n\n" : ""}${pedirDatos(e.nombre, textoDeFecha(e.fecha, hoy), e.hora, servicios, elegido?.nombre)}` };
  };

  // "no", "no gracias", "mejor no" cancelan; "no sé cuál elegir" o "no tengo correo" son dudas y NO deben cancelar la reserva.
  const cancela = NEGATIVO.test(t) && t.split(" ").length <= 4 && !/^no (se|sé|estoy seguro|estoy segura|tengo|entiendo|encuentro|puedo|me acuerdo)\b/.test(t);
  if (cancela) {
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
    // Nombra a un profesional que no está entre los ofrecidos ("quiero reservar rizos con Enzo"): no es elegir una de las horas, lo resuelve el resto del agente.
    if ((datos?.profesionales ?? []).some((p) => !op.some((o) => o.id === p.id) && nombreMencionado(t, p.nombre))) return null;
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
      const sin = nombradoSinEsaHora(t, op, (h) => coincideHora(h, q));
      if (sin) {
        // "con Pablo a las 5" y Pablo no tiene esa hora: se dice, y se queda solo con él para que elija otra de las suyas.
        await deps.guardarEstado({ etapa: "oferta", datos: { ...(estado.datos.servicioId ? { servicioId: estado.datos.servicioId } : {}), horaExacta: sin.horas.length === 1 ? sin.horas[0] : null, opciones: [sin] } });
        const horaTxt = op.flatMap((o) => o.horas).find((h) => coincideHora(h, q)) ?? `${q.h}:${String(q.m).padStart(2, "0")}`;
        return { texto: `*${sin.nombre}* no tiene a las ${horaTxt} ${textoDeFecha(sin.fecha, hoy)}. Con él tengo: ${sin.horas.slice(0, 6).join(" · ")}.\n\nEscríbeme la que prefieras, por ejemplo: «la de las ${sin.horas[0]}», o dime con quién más.` };
      }
      for (const o of op) for (const hora of o.horas) if (coincideHora(hora, q)) elegidas.push({ id: o.id, nombre: o.nombre, duracionMin: o.duracionMin, fecha: o.fecha, hora });
    } else if (estado.datos.horaPendiente) {
      const sinPend = nombradoSinEsaHora(t, op, (h) => h === estado.datos.horaPendiente);
      if (sinPend) {
        await deps.guardarEstado({ etapa: "oferta", datos: { ...(estado.datos.servicioId ? { servicioId: estado.datos.servicioId } : {}), horaExacta: sinPend.horas.length === 1 ? sinPend.horas[0] : null, opciones: [sinPend] } });
        return { texto: `*${sinPend.nombre}* no tiene a las ${estado.datos.horaPendiente} ${textoDeFecha(sinPend.fecha, hoy)}. Con él tengo: ${sinPend.horas.slice(0, 6).join(" · ")}.\n\nEscríbeme la que prefieras, o dime con quién más.` };
      }
      // Dijo una hora que tienen varios profesionales y se le preguntó con quién: ahora basta el nombre.
      for (const o of mejoresCoincidencias(t, op.filter((x) => x.horas.includes(estado.datos.horaPendiente!)))) elegidas.push({ id: o.id, nombre: o.nombre, duracionMin: o.duracionMin, fecha: o.fecha, hora: estado.datos.horaPendiente });
      if (elegidas.length === 0) {
        const candidatos = op.filter((o) => o.horas.includes(estado.datos.horaPendiente!));
        // "con cualquiera", "el primero", "da lo mismo": se toma el primero. Si no, se repite la pregunta en vez de perder al cliente.
        if (/\b(cualquiera|el primero|la primera|da lo mismo|me da lo mismo|el que sea|con quien sea|con el que (tenga|haya)|el que tenga|el que quede)\b/.test(t) && candidatos.length > 0) { const o = candidatos[0]; elegidas.push({ id: o.id, nombre: o.nombre, duracionMin: o.duracionMin, fecha: o.fecha, hora: estado.datos.horaPendiente }); }
        else if (candidatos.length > 1) return { texto: `Para dejarte la hora de las ${estado.datos.horaPendiente} necesito saber con quién:\n${candidatos.slice(0, 8).map((o, i) => `${i + 1}. ${o.nombre} (${textoDeFecha(o.fecha, hoy)})`).join("\n")}\n\nToca una opción o escríbeme el nombre. Si te da lo mismo, dime «con cualquiera».`, lista: listaProfesionales(candidatos) };
        else return null;
      }
    } else if (op.some((o) => nombreMencionado(t, o.nombre))) {
      // Solo dijo con quién ("con Matías"): si la consulta era por una hora exacta, es esa; si no, se le piden las horas de esa persona.
      const quien = mejoresCoincidencias(t, op);
      const exacta = estado.datos.horaExacta;
      // "Matías en la tarde" / "más tarde": pide un horario, no solo la persona. Lo resuelve la consulta de disponibilidad.
      if (!exacta && /\b(?:en|por|de) la (?:manana|mañana|tarde|noche)\b|\btemprano\b|\bm[aá]s tarde\b/.test(t)) return null;
      for (const o of quien) if (exacta && o.horas.includes(exacta)) elegidas.push({ id: o.id, nombre: o.nombre, duracionMin: o.duracionMin, fecha: o.fecha, hora: exacta });
      if (elegidas.length === 0) {
        const o = quien[0];
        // Se queda solo con esa persona: así un "sí" o "la de las 19:00" ya sabe a quién se refiere.
        await deps.guardarEstado({ etapa: "oferta", datos: { ...(estado.datos.servicioId ? { servicioId: estado.datos.servicioId } : {}), horaExacta: o.horas.length === 1 ? o.horas[0] : null, opciones: [o] } });
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
    const conNombre = mejoresCoincidencias(t, elegidas);
    if (conNombre.length > 0) elegidas = conNombre;
    const resumen = () => op.slice(0, 4).map((o) => `• *${o.nombre}* ${textoDeFecha(o.fecha, hoy)}: ${o.horas.slice(0, 3).join(" · ")}`).join("\n");
    // Pidió una hora concreta que no está entre las mostradas (solo se muestran algunas): se consulta la disponibilidad real en vez de decir que no existe.
    if (elegidas.length === 0 && /\b(?:a la|a las)\s+\d|\b\d{1,2}:\d{2}\b/.test(t)) return null;
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
    // Cambiando su cita: no corre el tope de horas agendadas (la nueva reemplaza a la anterior).
    let cambiando = false;
    try { cambiando = !!(deps.precargado && await deps.precargado()); } catch { cambiando = false; }
    if (cambiando) return await empezarDatos(e);
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
  // Acepta datos con etiquetas ("Nombre: Carlitos Run / Correo: ... / Servicio: corte"): se quitan las etiquetas.
  let resto = (correoM ? texto.replace(correoM[0], " ") : texto).replace(/\b(nombre completo|nombre|correo electronico|correo|email|e-mail|mail|servicio)\s*:/gi, " ");
  let servicio = todosServicios.length === 1 ? todosServicios[0] : (sel.servicioId ? todosServicios.find((x) => x.id === sel.servicioId) ?? null : null);
  if (!servicio) {
    const num = /(?:^|[\s,;])(\d{1,2})(?=$|[\s,;.)])/.exec(resto);
    const listaNum = sel.opcionesServicio?.length ? (sel.opcionesServicio.map((id) => todosServicios.find((x) => x.id === id)).filter(Boolean) as typeof servicios) : servicios;
    if (num && Number(num[1]) >= 1 && Number(num[1]) <= listaNum.length) { servicio = listaNum[Number(num[1]) - 1]; resto = resto.replace(num[0], " "); }
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
  // Escribió el servicio con sus palabras en otro orden ("corte más barba" = "Corte + Barba simple"): se compara por palabras sueltas.
  let ambiguos: typeof servicios | null = null;
  const STOP = new Set(["de", "con", "y", "mas", "el", "la", "un", "una", "los", "las", "quiero", "para", "por", "favor", "mi", "me"]);
  const toks = (x: string) => normalizar(x).split(/[^a-zñ0-9]+/).filter((w) => w.length >= 3 && !STOP.has(w));
  const vocab = Array.from(new Set(todosServicios.flatMap((x) => toks(x.nombre))));
  if (!servicio) {
    const mt = Array.from(new Set(toks(resto).filter((w) => vocab.some((v) => servCalza(w, v)))));
    const otras = toks(resto).filter((w) => !mt.includes(w)).length;
    if (mt.length >= 2 || (mt.length === 1 && (otras === 0 || mt[0] === "corte" || todosServicios.filter((x) => toks(x.nombre).some((v) => servCalza(mt[0], v))).length === 1))) { // "corte" a secas se entiende aunque venga con el nombre
      const cand = todosServicios.filter((x) => { const st = toks(x.nombre); return mt.every((m) => st.some((v) => servCalza(m, v))); });
      // Si uno solo tiene EXACTAMENTE esas palabras ("corte y cejas" = "Corte + Cejas", no "Corte + Barba + Cejas"), ese gana.
      const exacto = cand.filter((x) => toks(x.nombre).length === mt.length);
      // "corte" a secas es el corte básico ("Corte de cabello" / "Corte"): no hace falta preguntar entre todos los que empiezan con corte.
      const basico = cand.filter((x) => /^(corte|corte de cabello|corte clasico|corte simple)$/.test(normalizar(x.nombre)));
      const unico = cand.length === 1 ? cand[0] : exacto.length === 1 ? exacto[0] : mt.length === 1 && mt[0] === "corte" && basico.length >= 1 ? basico[0] : null;
      if (unico) { servicio = unico; for (const m of mt) resto = resto.replace(new RegExp(`\\b${m}\\b`, "gi"), " "); resto = resto.replace(/\b(m[aá]s|y|con)\b/gi, " ").replace(/\+/g, " "); }
      else if (cand.length > 1 && cand.length <= 8) ambiguos = cand;
    }
  }
  const pareceEnlace = /:\/\/|www\.|[A-Za-z0-9]\.[A-Za-z]{2,}/.test(resto);
  const limpio = pareceEnlace ? "" : resto.replace(/[,;:.()#/_+@\d]+/g, " ").replace(/\s+/g, " ").trim();
  // Un nombre no lleva palabras de servicios ("corte", "barba", "cejas"...) ni es una frase larga: si se pegó algo así, se saca; y más de 4 palabras no es un nombre.
  const palabras = limpio.split(" ").filter(Boolean).filter((w) => !vocab.includes(normalizar(w)));
  const nombreLimpio = palabras.join(" ");
  const nombreOk = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ'’\- ]{4,60}$/.test(nombreLimpio) && palabras.length >= 2 && palabras.length <= 4 && palabras.every((w) => /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(w));
  // Los datos se van juntando de a uno: lo nuevo se suma a lo que ya se había dado, y se pide solo lo que falta.
  const nombreNuevo = nombreOk ? mayusculas(nombreLimpio) : null;
  const nombre = sel.cliente ?? nombreNuevo ?? null; // el nombre ya dado no se pisa con otra frase (p. ej. el nombre de un servicio)
  const correo = correoNuevo ?? sel.correo ?? null;
  if (!nombre || !correo || !servicio) {
    const progreso = (!sel.cliente && !!nombreNuevo) || (!!correoNuevo && correoNuevo !== sel.correo) || (!!servicio && servicio.id !== sel.servicioId);
    const base: Seleccion = { ...sel, ...(nombre ? { cliente: nombre } : {}), ...(correo ? { correo } : {}), ...(servicio?.id ? { servicioId: servicio.id } : {}) };
    if (servicio) delete base.opcionesServicio;
    if (!servicio && ambiguos) return await siguientePaso({ ...base, opcionesServicio: ambiguos.map((x) => x.id!).filter(Boolean) }, true, ambiguos, deps, "Hay más de uno parecido, ¿cuál de estos?");
    return await siguientePaso(base, progreso, sel.opcionesServicio?.length ? (sel.opcionesServicio.map((id) => todosServicios.find((x) => x.id === id)).filter(Boolean) as typeof servicios) : servicios, deps);
  }
  const abonoFinal = textoDeAbono(servicio.nombre, datos);
  if (abonoFinal) return await pedirAbono(servicio.nombre, abonoFinal, sel.nombre, sel.fecha, sel.hora);
  const r = await deps.crearReserva({ profesionalId: sel.id, fecha: sel.fecha, hora: sel.hora, servicioId: servicio.id!, nombre, correo, telefono });
  await deps.borrarEstado();
  if (r.ok) {
    await deps.contar("reservas_cerradas");
    return { texto: `¡Listo, ${nombre.split(" ")[0]}! Tu hora quedó agendada:\n\n• *${sel.nombre}*\n• ${textoDeFecha(sel.fecha, hoy)} a las *${sel.hora}*\n• ${servicio.nombre}${lineaCodigo(r.codigo)}\n\nRecomendamos llegar unos minutos antes. Te enviamos el detalle a tu correo. Si necesitas cambiarla, escríbenos por aquí.` };
  }
  if (r.motivo === "ocupada") return { texto: "Esa hora se acaba de ocupar. Escríbeme y te muestro otras, por ejemplo: «tienen hora mañana»." };
  if (r.motivo === "no_cabe") return { texto: `Con *${servicio.nombre}* esa hora no alcanza: el servicio dura más de lo que le queda a *${sel.nombre}* ese día. Escríbeme «tienen hora para ${servicio.nombre.split(/[\s/]/)[0].toLowerCase()}» y te muestro las horas en que sí cabe.` };
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
/** "\n\n*Tu código de reserva es: XFD4D*" (vacío si el cliente aún no tiene código). */
const lineaCodigo = (c?: string | null) => (typeof c === "string" && /^[A-Za-z0-9]{3,12}$/.test(c.trim()) ? `\n\n*Tu código de reserva es: ${c.trim().toUpperCase()}*` : "");
function pedirDatos(profesional: string, dia: string, hora: string, servicios: Array<{ nombre: string; precio: number | null }>, servicioElegido?: string): string {
  return `Perfecto. Te dejo la hora con *${profesional}* ${dia} a las *${hora}*${servicioElegido ? ` para *${servicioElegido}*` : ""}.\n\nPara confirmarla, ¿cuál es tu nombre completo?\n(Si prefieres, mándame todo junto: nombre, correo${servicios.length > 1 ? " y servicio" : ""}.)\n\nEscribe *menú* para volver al inicio.`;
}

/** Pide solo lo que falta, de a uno: nombre, luego correo, luego servicio (con lista para tocar). Los datos ya dados quedan en la memoria de la reserva. */
async function siguientePaso(sel: Seleccion, progreso: boolean, servicios: Array<{ nombre: string; precio: number | null }>, deps: DependenciasReserva, encabezado?: string): Promise<RespuestaReserva> {
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
  return { texto: `${encabezado ?? `Último paso, ${primer}: ¿qué servicio quieres?`}\n${filas.map((s, i) => `${i + 1}. ${s.nombre}${typeof s.precio === "number" ? ` ($${moneda.format(s.precio)})` : ""}`).join("\n")}\n\nToca una opción o escríbeme el número.`, lista: listaServicios(filas) };
}
