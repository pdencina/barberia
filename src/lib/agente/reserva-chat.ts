// Reserva por WhatsApp: tras ofrecerle horas al cliente, entiende "quiero la de las 15:15", pide nombre/correo/servicio y deja la hora
// agendada. Determinista, sin IA. La memoria (inyectada) guarda SOLO qué horas se ofrecieron; nunca texto, nombre, correo ni teléfono.
// El nombre, el correo y el servicio se leen del mensaje en memoria y se envían directo a la reserva; si falta algo se vuelve a pedir
// TODO en un solo mensaje, sin guardar datos a medias. La cita se crea con las mismas reglas de la reserva web (inyectada).
import { normalizar, mensajeAdmitido, datoSeguro, type DatosFaq } from "./faq-fija";
import { ahoraChile, textoDeFecha, type Oferta } from "./disponibilidad";

export const VIGENCIA_MIN = 30;
export const MAX_RESERVAS_FUTURAS = 2;
export const MAX_INTENTOS_DATOS = 3;
const MAX_SERVICIOS_LISTADOS = 6;

export type CampoIndicador = "respuestas_automaticas" | "consultas_disponibilidad" | "ofertas_horas" | "reservas_iniciadas" | "reservas_cerradas" | "derivadas_persona";
export interface Seleccion { id: string; nombre: string; duracionMin: number; fecha: string; hora: string; intentos: number }
export type EstadoChat = { etapa: "oferta"; datos: Oferta & { horaPendiente?: string } } | { etapa: "datos"; datos: Seleccion };
export type ResultadoCreacion = { ok: true; citaId: string } | { ok: false; motivo: "ocupada" | "suspendido" | "otro" };
export interface DependenciasReserva {
  ahora: () => number;
  leerEstado: () => Promise<EstadoChat | null>;
  guardarEstado: (e: EstadoChat) => Promise<void>;
  borrarEstado: () => Promise<void>;
  reservasFuturas: (telefono: string) => Promise<number>;
  crearReserva: (a: { profesionalId: string; fecha: string; hora: string; servicioId: string; nombre: string; correo: string; telefono: string }) => Promise<ResultadoCreacion>;
  contar: (campo: CampoIndicador) => Promise<void>;
}
export type RespuestaReserva = { texto: string; derivar?: boolean } | null;

const NEGATIVO = /^(?:no|nop|nel|ya no|no gracias|gracias no|cancelar|cancelo|cancela|olvidalo|dejalo|deja|mejor no|nada)\b/;
const AFIRMATIVO = /^(?:si|dale|ok|okey|ya|listo|perfecto|esa|esa misma|me sirve|me interesa|la quiero|quiero esa|quiero agendar|agendala|agendame|agendame esa|reservala|reservame)\b/;
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

export async function manejarReservaChat(texto: unknown, telefono: string, datos: DatosFaq | null, deps: DependenciasReserva): Promise<RespuestaReserva> {
  const estado = await deps.leerEstado();
  if (!estado) return null;
  if (typeof texto !== "string" || !texto.trim() || texto.length > 200) return null;
  const hoy = ahoraChile(deps.ahora()).fecha;
  const t = normalizar(texto).replace(/\s+/g, " ").trim();

  if (NEGATIVO.test(t)) {
    await deps.borrarEstado();
    return { texto: "Sin problema, no agendé nada. Si quieres ver otras horas, escríbeme, por ejemplo: «tienen hora mañana»." };
  }

  // ---- 1) el cliente elige una de las horas ofrecidas
  if (estado.etapa === "oferta") {
    const admitido = mensajeAdmitido(texto);
    if (!admitido || PARECE_CONSULTA.test(t)) return null; // otra pregunta (o mensaje no admitido): sigue el camino normal
    const op = estado.datos.opciones;
    const q = horaMencionada(t);
    let elegidas: Array<{ id: string; nombre: string; duracionMin: number; fecha: string; hora: string }> = [];
    if (q) {
      for (const o of op) for (const hora of o.horas) if (coincideHora(hora, q)) elegidas.push({ id: o.id, nombre: o.nombre, duracionMin: o.duracionMin, fecha: o.fecha, hora });
    } else if (estado.datos.horaPendiente) {
      // Dijo una hora que tienen varios profesionales y se le preguntó con quién: ahora basta el nombre.
      for (const o of op) if (o.horas.includes(estado.datos.horaPendiente) && nombreMencionado(t, o.nombre)) elegidas.push({ id: o.id, nombre: o.nombre, duracionMin: o.duracionMin, fecha: o.fecha, hora: estado.datos.horaPendiente });
      if (elegidas.length === 0) return null;
    } else if (op.some((o) => nombreMencionado(t, o.nombre))) {
      // Solo dijo con quién ("con Matías"): si la consulta era por una hora exacta, es esa; si no, se le piden las horas de esa persona.
      const quien = op.filter((o) => nombreMencionado(t, o.nombre));
      const exacta = estado.datos.horaExacta;
      for (const o of quien) if (exacta && o.horas.includes(exacta)) elegidas.push({ id: o.id, nombre: o.nombre, duracionMin: o.duracionMin, fecha: o.fecha, hora: exacta });
      if (elegidas.length === 0) {
        const o = quien[0];
        return { texto: `Con *${o.nombre}* ${textoDeFecha(o.fecha, hoy)} tengo: ${o.horas.slice(0, 6).join(" · ")}.\n\nEscríbeme la hora que prefieras, por ejemplo: «la de las ${o.horas[0]}».` };
      }
    } else if (AFIRMATIVO.test(t) && estado.datos.horaExacta && op.length === 1 && op[0].horas.includes(estado.datos.horaExacta)) {
      elegidas = [{ id: op[0].id, nombre: op[0].nombre, duracionMin: op[0].duracionMin, fecha: op[0].fecha, hora: estado.datos.horaExacta }];
    } else return null;
    const conNombre = elegidas.filter((e) => nombreMencionado(t, e.nombre));
    if (conNombre.length > 0) elegidas = conNombre;
    const resumen = () => op.slice(0, 4).map((o) => `• *${o.nombre}* ${textoDeFecha(o.fecha, hoy)}: ${o.horas.slice(0, 3).join(" · ")}`).join("\n");
    if (elegidas.length === 0) return { texto: `Esa hora no está entre las que te ofrecí. Estas son las opciones:\n${resumen()}\n\nEscríbeme la hora que prefieras, por ejemplo: «la de las ${op[0].horas[0]}».` };
    if (elegidas.length > 1) {
      const quienes = Array.from(new Set(elegidas.map((e) => `*${e.nombre}* ${textoDeFecha(e.fecha, hoy)}`)));
      await deps.guardarEstado({ etapa: "oferta", datos: { ...estado.datos, horaPendiente: elegidas[0].hora } });
      return { texto: `¿Con quién prefieres a las ${elegidas[0].hora}?\n${quienes.map((x) => `• ${x}`).join("\n")}\n\nEscríbeme el nombre del profesional.` };
    }
    const e = elegidas[0];
    if ((await deps.reservasFuturas(telefono)) >= MAX_RESERVAS_FUTURAS) {
      await deps.borrarEstado();
      return { texto: `Ya tienes ${MAX_RESERVAS_FUTURAS} horas agendadas con nosotros. Para agendar otra, una persona te ayudará por aquí.`, derivar: true };
    }
    const servicios = (datos?.servicios ?? []).filter((s) => s && typeof s.id === "string" && datoSeguro(s.nombre)).slice(0, MAX_SERVICIOS_LISTADOS);
    if (servicios.length === 0) { await deps.borrarEstado(); return { texto: "Para dejar tu hora necesito que una persona te ayude con los detalles.", derivar: true }; }
    await deps.guardarEstado({ etapa: "datos", datos: { id: e.id, nombre: e.nombre, duracionMin: e.duracionMin, fecha: e.fecha, hora: e.hora, intentos: 0 } });
    await deps.contar("reservas_iniciadas");
    return { texto: pedirDatos(e.nombre, textoDeFecha(e.fecha, hoy), e.hora, servicios) };
  }

  // ---- 2) el cliente envía sus datos
  const sel = estado.datos;
  if (!CARACTERES.test(texto)) return faltan(sel, deps, "Para confirmar necesito tus datos en texto simple.");
  const servicios = (datos?.servicios ?? []).filter((s) => s && typeof s.id === "string" && datoSeguro(s.nombre)).slice(0, MAX_SERVICIOS_LISTADOS);
  if (servicios.length === 0) { await deps.borrarEstado(); return { texto: "Para dejar tu hora necesito que una persona te ayude con los detalles.", derivar: true }; }
  const correoM = CORREO.exec(texto);
  const correo = correoM ? correoM[0].toLowerCase() : null;
  let resto = correoM ? texto.replace(correoM[0], " ") : texto;
  let servicio = servicios.length === 1 ? servicios[0] : null;
  if (!servicio) {
    const num = /(?:^|[\s,;])(\d{1,2})(?=$|[\s,;.)])/.exec(resto);
    if (num && Number(num[1]) >= 1 && Number(num[1]) <= servicios.length) { servicio = servicios[Number(num[1]) - 1]; resto = resto.replace(num[0], " "); }
    else {
      const porNombre = servicios.filter((s) => normalizar(texto).includes(normalizar(s.nombre)));
      if (porNombre.length === 1) { servicio = porNombre[0]; resto = resto.replace(new RegExp(porNombre[0].nombre.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), " "); }
    }
  }
  const pareceEnlace = /:\/\/|www\.|[A-Za-z0-9]\.[A-Za-z]{2,}/.test(resto);
  const limpio = pareceEnlace ? "" : resto.replace(/[,;:.()#/_+@\d]+/g, " ").replace(/\s+/g, " ").trim();
  const palabras = limpio.split(" ").filter(Boolean);
  const nombreOk = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ'’\- ]{4,60}$/.test(limpio) && palabras.length >= 2 && palabras.length <= 6 && palabras.every((w) => /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(w));
  const falta: string[] = [];
  if (!nombreOk) falta.push("tu nombre completo");
  if (!correo) falta.push("tu correo");
  if (!servicio) falta.push("el servicio (el número de la lista)");
  if (falta.length > 0 || !correo || !servicio) {
    return faltan(sel, deps, `Me falta ${unirFaltas(falta)}.\n\n${ejemplo(servicios)}`);
  }
  const nombre = mayusculas(limpio);
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
  return servicios.length > 1 ? "Envíamelo todo en un solo mensaje, por ejemplo:\nJuan Pérez, juan@correo.cl, 1" : "Envíamelo todo en un solo mensaje, por ejemplo:\nJuan Pérez, juan@correo.cl";
}
function pedirDatos(profesional: string, dia: string, hora: string, servicios: Array<{ nombre: string; precio: number | null }>): string {
  const lista = servicios.length > 1 ? `\n• el servicio:\n${servicios.map((s, i) => `   ${i + 1}. ${s.nombre}${typeof s.precio === "number" ? ` ($${moneda.format(s.precio)})` : ""}`).join("\n")}` : "";
  return `Perfecto. Te dejo la hora con *${profesional}* ${dia} a las *${hora}*.\n\nPara confirmarla envíame en un solo mensaje:\n• tu nombre completo\n• tu correo${lista}\n\n${ejemplo(servicios)}`;
}
