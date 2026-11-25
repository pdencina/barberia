// 100 mensajes de WhatsApp contra el agente con los datos REALES de Estudio Levels (instantánea del 25-nov-2026, sin red ni llaves).
// Cubre los errores vistos en pruebas reales. Cada mensaje dice qué DEBE y qué NO DEBE aparecer en la respuesta.
// Uso: npx tsx scripts/test-agente-100-levels.ts   (VER=1 imprime todas las respuestas)
import { createHmac } from "node:crypto";
import { crearManejadoresWebhook, type DependenciasWebhook } from "../src/lib/agente/whatsapp-webhook";
import { crearRepositorioDatosNegocio } from "../src/lib/agente/datos-negocio";
import type { EventoUso } from "../src/lib/agente/limite-de-uso";

// ---- datos reales (instantánea) ----
const P = { enzo: "p-enzo", bleiner: "p-bleiner", felipe: "p-felipe", nico: "p-nico", vicente: "p-vicente", dylan: "p-dylan", javier: "p-javier", gabriel: "p-gabriel", pablo: "p-pablo", bastian: "p-bastian" };
const PROS: [string, string, string, number][] = [[P.enzo, "Enzo Perez", "enzo-perez-2fa2", 45], [P.bleiner, "Bleiner Useche", "bleiner-useche", 60], [P.felipe, "Felipe Meza", "felipe-meza-efb0", 45], [P.nico, "Nicolás Levels", "nico-perez", 30], [P.vicente, "Vicente Espinosa", "vicente-espinosa-08df", 45], [P.dylan, "Dylan Perez", "dylan-perez-f253", 45], [P.javier, "Javier García", "javier-garcia-1fd7", 45], [P.gabriel, "Gabriel Alcayaga", "gabriel-alcayaga-ae4a", 30], [P.pablo, "Pablo Yañez", "pablo-yanez", 45], [P.bastian, "Bastian ahumada ", "bastian-ahumada-9361", 45]];
const SERV: [string, string, number, number][] = [
  ["s-lav", "Corte + lavado de cabello", 18000, 45], ["s-ritual", "Ritual de barba paños calientes.", 18000, 45], ["s-cbc", "Corte + Barba + Cejas ", 26000, 60], ["s-cbcN", "Corte + Barba + Cejas Nicolás", 28000, 60],
  ["s-clN", "Corte + Lavado Nicolas", 20000, 30], ["s-cbp", "Corte + barba paños calientes.", 27000, 60], ["s-cejN", "Solo Cejas Nicolas ", 2000, 5], ["s-corte", "Corte de cabello ", 17000, 45], ["s-corteN", "Solo corte Nicolas", 18000, 30],
  ["s-cej", "Solo Cejas ", 1000, 5], ["s-dis", "Corte + Diseño simple", 19000, 45], ["s-ase", "Corte + Asesoría Nicolas", 50000, 90], ["s-cc", "Corte + Cejas", 18000, 45], ["s-bs", "Corte + Barba simple ", 24000, 60],
  ["s-tij", "Corte solo tijeras", 18000, 45], ["s-arr", "Arreglo de barba simple", 15000, 45], ["s-perm", "Permanente de rizos", 80000, 45], ["s-color", "Color Global ", 100000, 180], ["s-visos", "Visos", 85000, 180], ["s-rizos", "Rizos/Ondulación permanentes", 80000, 180],
];
const COMUN = ["s-dis", "s-cbc", "s-lav", "s-cc", "s-arr", "s-corte", "s-bs", "s-cbp", "s-tij", "s-ritual"];
const ASIG: Record<string, string[]> = {
  [P.enzo]: COMUN, [P.felipe]: COMUN, [P.vicente]: COMUN, [P.javier]: [...COMUN, "s-rizos", "s-color", "s-visos"], [P.pablo]: COMUN, [P.bastian]: COMUN, [P.bleiner]: [...COMUN, "s-cej"],
  [P.dylan]: [...COMUN, "s-rizos"], [P.gabriel]: ["s-rizos", "s-cc", "s-arr", "s-corte", "s-bs", "s-lav"], [P.nico]: ["s-color", "s-visos", "s-clN", "s-corteN", "s-cbcN", "s-cejN", "s-ase", "s-cbp"],
};
// horario semanal por profesional: [dia, trabaja, desde, hasta] (dia 0 = domingo)
const H = (rows: [number, boolean, string, string][]) => rows.map(([dia, trabaja, desde, hasta]) => ({ dia, trabaja, desde, hasta }));
const SEMANA: Record<string, ReturnType<typeof H>> = {
  [P.nico]: H([[0, false, "10:00", "20:00"], [1, true, "07:00", "10:00"], [2, true, "07:00", "10:00"], [3, true, "07:00", "10:00"], [4, true, "07:00", "10:00"], [5, true, "07:00", "10:00"], [6, true, "07:00", "09:00"]]),
  [P.pablo]: H([[0, false, "10:00", "20:00"], [1, true, "10:00", "20:00"], [2, false, "10:00", "20:00"], [3, true, "10:00", "20:00"], [4, true, "10:00", "20:00"], [5, true, "10:00", "20:00"], [6, true, "09:00", "18:00"]]),
  [P.enzo]: H([[0, false, "10:00", "20:00"], [1, false, "10:00", "20:00"], [2, true, "10:00", "20:00"], [3, true, "10:00", "20:00"], [4, true, "10:00", "20:00"], [5, true, "10:00", "20:00"], [6, true, "10:00", "17:15"]]),
  [P.gabriel]: H([[0, false, "10:00", "20:00"], [1, true, "10:00", "20:00"], [2, false, "10:00", "20:00"], [3, true, "10:00", "20:00"], [4, true, "10:00", "20:00"], [5, true, "10:00", "20:00"], [6, true, "09:00", "17:00"]]),
  [P.dylan]: H([[0, false, "10:00", "20:00"], [1, false, "10:00", "20:00"], [2, true, "10:00", "20:00"], [3, true, "10:00", "20:00"], [4, true, "10:00", "20:00"], [5, true, "10:00", "20:00"], [6, true, "09:00", "17:00"]]),
  [P.javier]: H([[0, false, "10:00", "20:00"], [1, true, "10:00", "22:00"], [2, true, "10:00", "22:00"], [3, true, "10:00", "22:00"], [4, true, "10:00", "22:00"], [5, true, "10:00", "22:00"], [6, true, "09:00", "20:00"]]),
  [P.bleiner]: H([[0, true, "10:00", "18:00"], [1, true, "10:00", "20:00"], [2, true, "10:00", "20:00"], [3, false, "11:00", "20:00"], [4, false, "10:00", "20:00"], [5, true, "10:00", "20:00"], [6, true, "09:00", "17:00"]]),
  [P.vicente]: H([[0, false, "10:00", "20:00"], [1, true, "10:00", "20:15"], [2, true, "10:00", "20:15"], [3, false, "10:00", "20:00"], [4, true, "10:00", "20:15"], [5, true, "10:00", "20:15"], [6, true, "09:00", "18:00"]]),
  [P.felipe]: H([[0, false, "10:00", "20:00"], [1, false, "10:00", "20:00"], [2, true, "10:00", "20:00"], [3, true, "10:00", "20:00"], [4, true, "10:00", "20:00"], [5, true, "10:00", "20:15"], [6, true, "09:00", "17:00"]]),
  [P.bastian]: H([[0, false, "10:00", "20:00"], [1, false, "10:00", "20:00"], [2, true, "10:00", "20:00"], [3, true, "10:00", "20:00"], [4, true, "10:00", "20:00"], [5, true, "10:00", "20:00"], [6, true, "09:00", "17:00"]]),
};
const VAC: Record<string, { desde: string; hasta: string }[]> = { [P.gabriel]: [{ desde: "2027-02-22", hasta: "2027-03-11" }] };
const NEGOCIO = { id: "T1", name: "Estudio Levels", slug: "estudiolevels", address: "Juan de Dios malebran 1889, Puente alto", phone: "+56984939625" };
const HORAS = [[1, "10:00", "20:00"], [2, "10:00", "20:00"], [3, "10:00", "20:00"], [4, "10:00", "20:00"], [5, "10:00", "20:00"], [6, "09:00", "17:00"], [0, "12:00", "18:00"]] as const;

// ---- simulador ----
const AHORA = Date.UTC(2026, 10, 25, 19, 45); // miércoles 25-nov-2026, 16:45 Chile
const secret = "s", salt = "x", phone = "56911112222";
let serial = 0;
const payload = (m: Record<string, unknown>) => ({ object: "whatsapp_business_account", entry: [{ changes: [{ field: "messages", value: { messaging_product: "whatsapp", metadata: { phone_number_id: "1001" }, messages: [{ id: `in.${++serial}`, from: phone, type: "text", ...m }] } }] }] });
const request = (p: unknown) => { const b = JSON.stringify(p); return new Request("https://t.invalid/w", { method: "POST", body: b, headers: { "x-hub-signature-256": `sha256=${createHmac("sha256", secret).update(b).digest("hex")}` } }); };
const diaStr = (n: number) => new Date(AHORA + n * 86400000).toISOString().slice(0, 10);
const nombre = (id: string) => PROS.find((p) => p[0] === id)?.[1] ?? "?";

function crear() {
  const sent: string[] = [], notices: string[] = [], events: any[] = [];
  const memoria = new Map<string, any>(); const citas: any[] = [];
  const tables: Record<string, any[]> = {
    tenants: [{ ...NEGOCIO, active: true }],
    business_hours: HORAS.map((h, i) => ({ id: `h${i}`, tenant_id: "T1", day_of_week: h[0], is_closed: false, open_time: h[1], close_time: h[2] })),
    services: SERV.map((s) => ({ id: s[0], tenant_id: "T1", name: s[1], price: s[2], duration: s[3], active: true })),
    barber_service_assignments: Object.entries(ASIG).flatMap(([b, ss]) => ss.map((x) => ({ barber_id: b, service_id: x }))),
    branches: [], profiles: PROS.map((p) => ({ id: p[0], tenant_id: "T1", name: p[1], booking_slug: p[2], active: true, role: "barber", also_attends_clients: false, slot_duration: p[3] })), agent_faq_custom: [],
  };
  const db = { from(table: string) {
    const filters: [string, any][] = []; let single = false, from = 0, to = 999;
    const chain: any = { select: () => chain, in: (k: string, vals: unknown[]) => { filters.push([k, (x: unknown) => vals.includes(x)]); return chain; }, eq: (k: string, v: unknown) => { filters.push([k, v]); return chain; }, order: () => chain, limit: () => chain, range: (a: number, b: number) => { from = a; to = b; return chain; }, maybeSingle: () => { single = true; return chain; },
      then: (res: any) => { const rows = (tables[table] ?? []).filter((r) => filters.every(([k, v]) => (typeof v === "function" ? (v as any)(r[k]) : r[k] === v))).slice(from, to + 1); res({ data: single ? rows[0] ?? null : rows, error: null }); } };
    return chain; } };
  const repoDatos = crearRepositorioDatosNegocio(db, { enlace: async () => `https://www.re-booking.cl/${NEGOCIO.slug}` });
  const deps: any = {
    ahora: () => AHORA,
    repo: { negocio: async (id: string) => id === "1001" ? { tenantId: "T1", phoneNumberId: id, enabled: true } : null,
      admitir: async (e: any) => { const c = events.filter((x) => x.contactHash === e.contactHash); events.push({ ...e, atMs: e.ahora }); return { repetido: false, historial: c.filter((x) => x.atMs > e.ahora - 3600000) as EventoUso[], consecutivos: 0 }; },
      terminar: async () => {}, baja: async () => false, guardarBaja: async () => {}, reclamarAviso: async () => true, referenciaAlternativa: async () => null, referencia: async () => null },
    accion: async () => ({ motivo: "ok" }), responder: async (_n: any, _p: any, t: string) => { sent.push(t); }, avisarAdministrador: async (t: string) => { notices.push(t); },
    datosDelNegocio: repoDatos.datosDelNegocio,
  };
  // Horas libres según el horario REAL del profesional (días que no trabaja = cerrado; vacaciones = cerrado); algunas horas ocupadas.
  deps.horasLibres = async (id: string, fecha: string, dur: number) => {
    const dow = new Date(fecha + "T12:00:00Z").getUTCDay();
    const t = (SEMANA[id] ?? []).find((x) => x.dia === dow);
    if (!t || !t.trabaja || (VAC[id] ?? []).some((v) => fecha >= v.desde && fecha <= v.hasta)) return { slots: [], cerrado: true, fueraDeVentana: false };
    const [ah, am] = t.desde.split(":").map(Number), [ch, cm] = t.hasta.split(":").map(Number);
    const slots: string[] = [];
    for (let m = ah * 60 + am, i = 0; m + dur <= ch * 60 + cm; m += dur, i++) {
      if (i % 4 === 1) continue; // ocupada
      if (fecha === diaStr(0) && m < 17 * 60 + 0) continue; // ya pasó
      slots.push(`${fecha}T${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}:00`);
    }
    return { slots, cerrado: false, fueraDeVentana: false };
  };
  deps.chat = {
    leerEstado: async (t: string, c: string) => memoria.get(t + c) ?? null, guardarEstado: async (t: string, c: string, e: any) => { memoria.set(t + c, e); }, borrarEstado: async (t: string, c: string) => { memoria.delete(t + c); },
    reservasFuturas: async () => citas.length, detalleFuturas: async () => [], crearReserva: async (_t: string, a: any) => { const dur = SERV.find((x) => x[0] === a.servicioId)?.[3] ?? 45; const libres = (await deps.horasLibres(a.profesionalId, a.fecha, dur)).slots.map((x: string) => x.slice(11, 16)); if (!libres.includes(a.hora)) return { ok: false, motivo: "no_cabe" }; citas.push({ servicio: a.servicioId, nombre: nombre(a.profesionalId), fecha: a.fecha, hora: a.hora }); return { ok: true, citaId: "c" + citas.length }; }, contar: async () => {},
  };
  deps.conMenu = true; deps.conCta = true; deps.derivarAlTelefono = true;
  deps.ia = async () => null; // la IA no responde en el simulador: lo que le llegue se marca
  deps.responderLista = async (_n: any, _p: any, l: any) => { sent.push(`[LISTA] ${l.cuerpo.replace(/\n+/g, " / ")}  {${l.filas.map((f: any) => f.title).join(" | ")}}`); return { estado: "aceptado" }; };
  deps.serviciosPorProfesional = async (_t: string, ids: string[]) => Object.fromEntries(ids.map((i) => [i, ASIG[i] ?? null]));
  deps.horariosProfesionales = async (_t: string, ids: string[]) => ({ semana: Object.fromEntries(ids.map((i) => [i, SEMANA[i] ?? []])), vacaciones: Object.fromEntries(ids.map((i) => [i, VAC[i] ?? []])) });
  const h = crearManejadoresWebhook({ secretoFirma: secret, tokenVerificacion: "v", salHashes: salt, crearDependencias: () => deps });
  return { citas, async enviar(m: string) { const antes = sent.length; await h.POST(request(payload({ text: { body: m } }))); return sent.slice(antes).join("\n") || "(sin respuesta)"; } };
}

// ---- casos: [mensaje, debe incluir (regex), no debe incluir (regex)] agrupados en conversaciones (el estado se arrastra dentro de una conversación) ----
type Caso = [string, (string | RegExp)[], (string | RegExp)[]?];
const NO_ENTENDI = /No entend/i;
const NEGOCIO_HORARIO = /Atendemos de lunes/i;
const conv: { titulo: string; casos: Caso[] }[] = [
  { titulo: "Horario de un profesional (error: respondía las horas del negocio o solo las de hoy)", casos: [
    ["Nicolás atiende en las mañanas ahora?", [/Sí/, /Nicolás Levels/, /07:00 a 10:00/], [NEGOCIO_HORARIO]],
    ["pero quiero saber si nicolas ahora atiende solo en las mañanas?", [/Nicolás Levels/, /mañana/i], [NEGOCIO_HORARIO]],
    ["que horarios tiene nicolas?", [/07:00 a 10:00/], [NEGOCIO_HORARIO]],
    ["a que hora entra nicolas?", [/07:00/], [NEGOCIO_HORARIO]],
    ["nicolas atiende en las tardes?", [/^No/m, /Nicolás/], [NEGOCIO_HORARIO]],
    ["que dias trabaja nicolas?", [/lunes a viernes de 07:00 a 10:00/, /sábado de 07:00 a 09:00/]],
    ["nicolas trabaja los domingos?", [/no atiende los domingos/]],
    ["que dias libra nicolas?", [/no trabaja los domingos/]],
    ["cuales son los dias libres de nicolas", [/no trabaja los domingos/]],
  ] },
  { titulo: "Horario de otros profesionales", casos: [
    ["que dias libra pablo?", [/no trabaja los martes y domingos/]],
    ["pablo atiende los sábados?", [/09:00 a 18:00/]],
    ["horario de enzo", [/10:00 a 20:00/], [NEGOCIO_HORARIO]],
    ["enzo trabaja los lunes?", [/no atiende los lunes/]],
    ["a que hora cierra felipe los sabados?", [/17:00/]],
    ["bleiner trabaja domingo?", [/10:00 a 18:00/]],
    ["vicente atiende hasta que hora el viernes?", [/20:15/]],
    ["dylan atiende los lunes?", [/no atiende los lunes/]],
    ["javier atiende en la noche?", [/Sí/, /Javier/]],
    ["bastian trabaja los martes?", [/Sí/, /Bastian/]],
    ["que dias trabaja gabriel?", [/lunes/, /Gabriel/]],
    ["enzo atiende en la mañana?", [/Sí/, /Enzo/]],
    ["felipe atiende los domingos?", [/no atiende los domingos/]],
  ] },
  { titulo: "Vacaciones", casos: [
    ["gabriel tiene vacaciones?", [/22 de febrero/, /11 de marzo/]],
    ["cuando vuelve gabriel de vacaciones?", [/marzo/]],
    ["pablo tiene vacaciones?", [/No tiene vacaciones/]],
    ["nicolas esta de vacaciones?", [/No tiene vacaciones/]],
  ] },
  { titulo: "Servicios: quién hace qué (error: Enzo/Pablo ofrecidos para rizos)", casos: [
    ["quien hace rizos?", [/Gabriel Alcayaga/, /Dylan Perez/], [/Enzo/, /Pablo/]],
    ["enzo hace rizos?", [/Enzo Perez\*? no hace/], [NO_ENTENDI]],
    ["pablo hace permanentes?", [/Pablo Yañez\*? no hace/]],
    ["quien hace visos?", [/Nicolás Levels/], [/Enzo/, /Gabriel/]],
    ["gabriel hace rizos?", [/Sí/, /Gabriel/]],
    ["dylan hace rizos?", [/Sí/, /Dylan/]],
    ["quiero reservar risos", [/Javier/, /Rizos/], [/Enzo/, /Pablo/, /Dale! Elige una/]],
    ["quiero reservar risos con enzo", [/Enzo Perez\*? no hace/, /Gabriel/], [/Con \*?Enzo Perez\*? hoy tengo/]],
    ["quien hace color?", [/Nicolás Levels/], [/Enzo/]],
    ["nicolas hace color global?", [/Sí/, /Nicolás/]],
    ["quien hace ondulacion?", [/Gabriel/, /Dylan/], [/Enzo/]],
    ["dylan hace visos?", [/Dylan Perez\*? no hace/]],
    ["quien hace permanente de rizos?", [/Gabriel/, /Dylan/], [/Por ahora no tengo/]],
    ["enzo hace visos?", [/Enzo Perez\*? no hace/, /Nicolás/]],
    ["gabriel hace color?", [/Gabriel Alcayaga\*? no hace/]],
    ["quien hace visos y color?", [/Nicolás/]],
    ["me quiero hacer unos visos, quien los hace?", [/Nicolás Levels/]],
    ["con quien puedo hacerme rizos?", [/Gabriel/, /Dylan/]],
  ] },
  { titulo: "Disponibilidad: seguimiento (errores: 'martes 1' → curso, 'a las 5' → no ofrecida, 'em sábado')", casos: [
    ["nicolas tiene hora mañana?", [/Nicolás Levels/, /07:/]],
    ["y el martes 1?", [/martes 1 de diciembre/i], [/curso/i, /cupos/i, NO_ENTENDI]],
    ["y em sábado?", [/sábado/i], [NEGOCIO_HORARIO, /curso/i]],
    ["y el viernes?", [/viernes/i], [/curso/i]],
  ] },
  { titulo: "Disponibilidad: Pablo el lunes + 'a las 5' (error)", casos: [
    ["Y pablo tiene hora el próximo lunes?", [/Pablo Yañez/, /lunes 30/i]],
    ["A las 5", [/17:/], [/no está entre las que te ofrecí/i, NO_ENTENDI]],
  ] },
  { titulo: "Reserva de rizos con Enzo (error: agendó igual)", casos: [
    ["quiero reservar risos", [/Gabriel/], [/Enzo/]],
    ["quiero reservar risos con enzo", [/no hace/], [/hoy tengo/]],
    ["a las 17:15", [], [/Te dejo la hora con Enzo/]],
  ] },
  { titulo: "Rizos con Javier de punta a punta (errores: horas 20:30/21:15 para 3 h, 'rizo', y volvía a pedir el servicio)", casos: [
    ["quiero reservar rizos", [/Rizos\/Ondulación permanentes/, /3 horas/, /Javier/], [/2[0-3]:\d\d/, /Enzo/, /\brizo\b/i]],
    ["javier", [/Javier García/, /19:00/], [/2[0-3]:\d\d/]],
    ["19:00", [/para \*Rizos\/Ondulación permanentes\*/, /nombre completo/i], [/qué servicio/i]],
    ["nicolas perez, nico@gmail.com", [/¡Listo/, /Rizos\/Ondulación permanentes/], [/Visos/, /qué servicio/i, /Último paso/]],
  ] },
  { titulo: "Pidió rizos al final con la hora de un servicio corto (error: agendó Visos 21:15 a 00:15)", casos: [
    ["javier tiene hora hoy?", [/Javier García/]],
    ["21:15", [/nombre completo/i]],
    ["nicolas perez, nico@gmail.com, rizos", [/no alcanza/i], [/¡Listo/, /Visos/, /Último paso/]],
  ] },
  { titulo: "Visos no se confunde con rizos", casos: [
    ["quiero reservar visos", [/Visos/, /3 horas/, /Nicolás/, /Javier/], [/Gabriel/, /Dylan/, /\brizo\b/i]],
    ["javier", [/Javier García/]],
    ["19:00", [/para \*Visos\*/]],
    ["nicolas perez, nico@gmail.com", [/¡Listo/, /Visos/], [/Rizos/]],
  ] },
  { titulo: "Color global", casos: [["quiero agendar color global", [/Color Global/, /3 horas/, /Nicolás/, /Javier/], [/Gabriel/, /Enzo/]]] },
  { titulo: "Rizos sin 'quiero': pregunta directa", casos: [["tienen hora para rizos?", [/3 horas/, /Gabriel|Javier|Dylan/], [/Enzo/, /Pablo/]]] },
  { titulo: "Rizos hoy a las 7 de la tarde", casos: [["rizos hoy a las 7 de la tarde", [/19:00/], [/2[0-3]:\d\d/]]] },
  { titulo: "Rizos hoy 19:00", casos: [["rizos hoy a las 19:00", [/19:00/], [/2[0-3]:\d\d/]]] },
  { titulo: "Rizos a las 8 de la noche (no cabe)", casos: [["rizos hoy a las 8 de la noche", [/no/i], [/Listo/]]] },
  { titulo: "Javier 7 de la tarde", casos: [["javier tiene hora hoy a las 7 de la tarde?", [/19:00/]]] },
  { titulo: "Rizos 7 tarde sin hoy", casos: [["tienen hora para rizos a las 7 de la tarde?", [/19:00/]]] },
  { titulo: "Javier a las 7", casos: [["javier tiene hora hoy a las 7?", [/Javier/]]] },
  { titulo: "Primera pregunta sin 'hola' (no todos parten con hola)", casos: [
    ["que horario tienen?", [/lunes a viernes de 10:00 a 20:00/i]],
  ] },
  { titulo: "Dirección", casos: [["donde estan?", [/Malebran/i]]] },
  { titulo: "Precio corte", casos: [["cuanto cuesta un corte?", [/17\.000/]]] },
  { titulo: "Precio visos", casos: [["cuanto cuestan los visos?", [/85\.000/]]] },
  { titulo: "Precio rizos", casos: [["cuanto cuesta el rizo permanente?", [/80\.000/]]] },
  { titulo: "Domingo", casos: [["abren el domingo?", [/12:00/]]] },
  { titulo: "Sábado", casos: [["hasta que hora atienden los sabados?", [/17:00/]]] },
  { titulo: "Cierres sin contexto (error: 'No entendí' a 'Hora confirmada' / 'Ok gracias')", casos: [["Hora confirmada", [], [NO_ENTENDI]]] },
  { titulo: "Ok gracias", casos: [["Ok gracias", [], [NO_ENTENDI]]] },
  { titulo: "Perfecto gracias", casos: [["Perfecto gracias", [], [NO_ENTENDI]]] },
  { titulo: "Ok", casos: [["ok", [], [NO_ENTENDI]]] },
  { titulo: "Gracias", casos: [["gracias", [], [NO_ENTENDI]]] },
  { titulo: "Listo", casos: [["listo", [], [NO_ENTENDI]]] },
  { titulo: "Confirmo", casos: [["confirmo mi cita", [], [NO_ENTENDI]]] },
  { titulo: "Si voy", casos: [["si voy", [], [NO_ENTENDI]]] },
  { titulo: "Saludo + menú", casos: [["hola", [/asistente/i]], ["quiero reservar una hora", [], [NO_ENTENDI]]] },
  { titulo: "Buenas tardes", casos: [["buenas tardes", [/asistente/i]]] },
  { titulo: "Agendar con nombre", casos: [["Nicolas", [/Nicolás Levels/]], ["Después del viernes que hora mas tiene?", [/viernes/i], [/curso/i]]] },
  { titulo: "Otra hora de nicolas", casos: [["nicolas tiene hora el viernes?", [/Nicolás/]], ["Que otra hora disponible tiene nicolas?", [/Nicolás/]]] },
  { titulo: "Más horas hoy", casos: [["que horas tienen hoy?", [/hoy/i]]] },
  { titulo: "Primera hora libre", casos: [["cual es la primera hora libre?", [/hora/i]]] },
  { titulo: "Pablo por nombre", casos: [["pablo", [/Pablo Yañez/]]] },
  { titulo: "Enzo por nombre", casos: [["enzo", [/Enzo Perez/]]] },
  { titulo: "Gabriel mañana", casos: [["gabriel tiene hora mañana?", [/Gabriel Alcayaga/]]] },
  { titulo: "Dylan viernes", casos: [["dylan tiene hora el viernes?", [/Dylan Perez/]]] },
  { titulo: "Bleiner domingo", casos: [["bleiner tiene hora el domingo?", [/Bleiner Useche/]]] },
  { titulo: "Javier a las 8", casos: [["javier tiene hora a las 8 de la noche?", [/Javier García/]]] },
  { titulo: "Felipe martes", casos: [["felipe tiene hora el martes?", [/Felipe Meza/]]] },
  { titulo: "Vicente sábado", casos: [["vicente tiene hora el sábado?", [/Vicente Espinosa/]]] },
  { titulo: "Bastian jueves", casos: [["bastian tiene hora el jueves?", [/Bastian/]]] },
  { titulo: "Gabriel en vacaciones", casos: [["gabriel tiene hora el 1 de marzo?", [/Gabriel Alcayaga/], [/curso/i]]] },
  { titulo: "Quién atiende hoy", casos: [["quien atiende hoy?", [/hoy/i]]] },
  { titulo: "Corte tijeras precio", casos: [["cuanto cuesta el corte con tijeras?", [/18\.000/]]] },
  { titulo: "Barba precio", casos: [["cuanto cuesta arreglo de barba?", [/15\.000/]]] },
  { titulo: "Color precio", casos: [["cuanto cuesta el color global?", [/100\.000/]]] },
  { titulo: "Servicios lista", casos: [["que servicios tienen?", [/Corte/i]]] },
  { titulo: "Teléfono", casos: [["cual es el telefono?", [/984939625|98493 9625|9 8493 9625/]]] },
  { titulo: "Link reserva", casos: [["me das el link para reservar?", [/re-booking\.cl/]]] },
  { titulo: "Cancelar", casos: [["quiero cancelar mi hora", [], [NO_ENTENDI]]] },
  { titulo: "Cambiar", casos: [["quiero cambiar mi hora", [], [NO_ENTENDI]]] },
  { titulo: "Humano", casos: [["quiero hablar con una persona", [/984939625|persona/i]]] },
  { titulo: "Nicolás tarde (no atiende)", casos: [["nicolas tiene hora en la tarde?", [/Nicolás Levels/]]] },
  { titulo: "Pablo mañana tarde", casos: [["pablo atiende en la tarde?", [/Sí/, /Pablo/]]] },
  { titulo: "Quién atiende domingo", casos: [["quien atiende el domingo?", [/domingo/i]]] },
  { titulo: "Rizos precio con duración", casos: [["cuanto demora el rizo permanente?", [/rizo/i]]] },
];

(async () => {
  let ok = 0, mal = 0; const fallas: string[] = [];
  for (const c of conv) {
    const s = crear();
    for (const [msg, debe, nodebe] of c.casos) {
      const r = await s.enviar(msg);
      const faltan = debe.filter((d) => !(typeof d === "string" ? r.includes(d) : d.test(r)));
      const sobran = (nodebe ?? []).filter((d) => (typeof d === "string" ? r.includes(d) : d.test(r)));
      const bien = faltan.length === 0 && sobran.length === 0;
      if (bien) ok++; else { mal++; fallas.push(`✗ [${c.titulo}] «${msg}»\n    faltan: ${faltan.join(" | ") || "-"}  sobran: ${sobran.join(" | ") || "-"}\n    ↳ ${r.replace(/\n+/g, " / ").slice(0, 300)}`); }
      if (process.env.VER) console.log(`${bien ? "✓" : "✗"} «${msg}»\n    ↳ ${r.replace(/\n+/g, " / ").slice(0, 400)}`);
    }
  }
  console.log(`\n${ok + mal} mensajes: ${ok} bien, ${mal} mal`);
  for (const f of fallas) console.log(f);
  process.exit(mal ? 1 : 0);
})();
