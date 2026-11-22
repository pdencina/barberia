// Diagnostico de «mis clientes no pueden reservar»: revisa, con los datos reales del negocio, lo que puede impedir o confundir una reserva online.
// Puro: recibe una instantanea del negocio y devuelve hallazgos en palabras simples (se prueba sin base de datos). Solo LEE; nunca cambia nada.
export interface Hallazgo { nivel: "problema" | "aviso"; titulo: string; detalle: string; ruta?: string }

export interface InstantaneaNegocio {
  hoy: string; // YYYY-MM-DD en Chile
  tenant: { status: string | null; trial_ends_at: string | null; slug: string | null; booking_window_days: number | null };
  ajustes: { booking_enabled: boolean | null; deposit_enabled: boolean | null; mpConfigurado: boolean };
  profesionales: { id: string; name: string; role: string; active: boolean; also_attends_clients: boolean | null }[];
  horarios: { barber_id: string; day_of_week: number; is_working: boolean | null }[];
  horarioNegocio: { day_of_week: number; is_closed: boolean | null }[];
  servicios: { id: string; name: string; active: boolean; internal_only: boolean | null }[];
  asignaciones: { barber_id: string; service_id: string }[];
  vacaciones: { barber_id: string; start_date: string; end_date: string }[];
}

const sumarDias = (f: string, n: number) => new Date(Date.parse(`${f}T12:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

export function diagnosticar(i: InstantaneaNegocio): Hallazgo[] {
  const out: Hallazgo[] = [];
  const t = i.tenant;

  if (t.status === "suspended" || t.status === "cancelled") {
    out.push({ nivel: "problema", titulo: "Tu cuenta está suspendida", detalle: "Mientras esté suspendida, tus clientes no pueden reservar. Revisa tu suscripción en Plan y facturación.", ruta: "/dashboard/configuracion/facturacion" });
  } else if (t.status === "trial" && t.trial_ends_at && t.trial_ends_at.slice(0, 10) < i.hoy) {
    out.push({ nivel: "problema", titulo: "Tu período de prueba terminó", detalle: "Para seguir recibiendo reservas, elige un plan en Plan y facturación.", ruta: "/dashboard/configuracion/facturacion" });
  }
  if (i.ajustes.booking_enabled === false) out.push({ nivel: "problema", titulo: "La reserva online está apagada", detalle: "Tu link de reserva está desactivado, así que nadie puede agendar por internet.", ruta: "/dashboard/configuracion" });
  if (!t.slug) out.push({ nivel: "aviso", titulo: "Tu negocio no tiene un link de reserva con nombre", detalle: "Crea o revisa tu link en Configuración > Link de Reserva Online.", ruta: "/dashboard/configuracion" });
  if (i.ajustes.deposit_enabled && !i.ajustes.mpConfigurado) {
    out.push({ nivel: "problema", titulo: "El abono está activado, pero Mercado Pago no está conectado", detalle: "Tus clientes llegan al pago y no pueden completarlo. Conecta Mercado Pago en Terminal POS o apaga el abono en Configuración.", ruta: "/dashboard/terminal-pos" });
  }

  const reservables = i.profesionales.filter((p) => p.active && (p.role === "barber" || (p.role === "admin" && p.also_attends_clients)));
  if (reservables.length === 0) {
    out.push({ nivel: "problema", titulo: "Nadie figura atendiendo clientes", detalle: "Por eso la reserva dice «no hay profesionales disponibles». Si atiendes tú, entra a Equipo, abre tu perfil y activa que atiendes clientes; si no, agrega a un profesional.", ruta: "/dashboard/barberos" });
  }

  const publicos = i.servicios.filter((s) => s.active && !s.internal_only);
  if (publicos.length === 0) {
    out.push({ nivel: "problema", titulo: "No tienes servicios activos", detalle: "Sin servicios, el cliente no puede elegir qué reservar. Crea al menos uno en Servicios (los «internos» no se muestran en la reserva).", ruta: "/dashboard/servicios" });
  }

  const negocioAbierto = i.horarioNegocio.filter((h) => !h.is_closed).length;
  const negocioTodoCerrado = i.horarioNegocio.length > 0 && negocioAbierto === 0;
  for (const p of reservables) {
    const filas = i.horarios.filter((h) => h.barber_id === p.id);
    if (filas.length > 0 && !filas.some((h) => h.is_working)) {
      out.push({ nivel: "problema", titulo: `${p.name} no tiene ningún día de trabajo`, detalle: "Todos sus días están marcados como libres, así que no tiene horas para reservar. Actívale sus días en Equipo > Horario.", ruta: `/dashboard/barberos/${p.id}` });
    } else if (filas.length === 0 && negocioTodoCerrado) {
      out.push({ nivel: "problema", titulo: "El horario del negocio está cerrado todos los días", detalle: `${p.name} no tiene horario propio y el del negocio está cerrado de lunes a domingo. Abre al menos un día en Configuración > Horario del Negocio.`, ruta: "/dashboard/configuracion" });
    }
    const mias = i.asignaciones.filter((a) => a.barber_id === p.id);
    if (mias.length > 0 && !mias.some((a) => publicos.some((s) => s.id === a.service_id))) {
      out.push({ nivel: "problema", titulo: `${p.name} no tiene servicios disponibles para reservar`, detalle: "Tiene servicios asignados, pero ninguno está activo (o son internos). Revisa Servicios > Precios por profesional.", ruta: "/dashboard/barberos/precios" });
    }
  }

  if (reservables.length > 0) {
    const finSemana = sumarDias(i.hoy, 7);
    const todosDeVacaciones = reservables.every((p) => i.vacaciones.some((v) => v.barber_id === p.id && v.start_date <= i.hoy && v.end_date >= finSemana));
    if (todosDeVacaciones) out.push({ nivel: "aviso", titulo: "Todo tu equipo está de vacaciones esta semana", detalle: "No se ofrecen horas mientras dura. Revisa Mi negocio > Vacaciones.", ruta: "/dashboard/vacaciones" });
  }
  if (t.booking_window_days !== null && t.booking_window_days <= 1) {
    out.push({ nivel: "aviso", titulo: `Solo se puede reservar con ${t.booking_window_days} día de anticipación`, detalle: "Puedes ampliar los días para agendar en Configuración > Preferencias de reservas.", ruta: "/dashboard/configuracion/reservas" });
  }
  return out;
}

// El texto que Oti le dice a la persona (con saltos de linea, listo para mostrar).
export function resumenDiagnostico(h: Hallazgo[]): string {
  if (h.length === 0) {
    return "Revisé tu negocio y, por mi lado, todo se ve bien para recibir reservas: hay profesionales atendiendo, servicios activos, horarios abiertos y el pago de abono (si lo usas) conectado.\nSi un cliente igual no puede reservar, pídele que te cuente qué mensaje ve (o una captura) y avísame, o abre un caso en Ayuda y soporte.";
  }
  const problemas = h.filter((x) => x.nivel === "problema"), avisos = h.filter((x) => x.nivel === "aviso");
  const fila = (x: Hallazgo, i: number) => `${i + 1}. ${x.titulo}. ${x.detalle}`;
  return [
    problemas.length ? `Encontré ${problemas.length === 1 ? "1 problema" : `${problemas.length} problemas`} que pueden impedir reservas:\n${problemas.map(fila).join("\n")}` : "",
    avisos.length ? `${problemas.length ? "\n" : ""}Y ${avisos.length === 1 ? "1 cosa para revisar" : `${avisos.length} cosas para revisar`}:\n${avisos.map(fila).join("\n")}` : "",
  ].filter(Boolean).join("\n");
}

// ¿La persona esta diciendo que sus clientes no logran reservar? (texto ya sin tildes ni mayusculas, ver norm())
export const PIDE_DIAGNOSTICO = new RegExp([
  "\\bno (?:me )?(?:pueden|puede|puedo|deja|dejan|logra|logran|logro) (?:\\w+ ){0,3}(?:reservar|agendar)",
  "\\bno (?:se )?(?:puede|pueden) (?:reservar|agendar)",
  "\\bno (?:me )?(?:deja|dejan) (?:\\w+ ){0,2}(?:reservar|agendar)",
  "\\bproblemas? (?:para|al|con|de) (?:\\w+ ){0,2}(?:reservar|agendar|reservas|agenda)",
  "\\bno hay (?:\\w+ )?(?:profesionales|horas|horarios|cupos) disponibles",
  "\\bno (?:me )?(?:aparecen|salen|sale|aparece) (?:\\w+ ){0,2}(?:horas|horarios|profesionales|servicios|dias)",
  "\\bpor que no (?:me )?(?:reservan|agendan|pueden reservar)",
  "\\bmi link (?:de reserva )?no (?:funciona|abre|sirve)",
  "\\b(?:diagnostic\\w*|revis\\w+) (?:de )?(?:mi|el) (?:negocio|link|reserva|agenda online)",
  "\\bmis clientes no (?:pueden|logran|consiguen)",
].join("|"));
