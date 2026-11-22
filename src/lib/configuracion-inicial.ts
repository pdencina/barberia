// Checklist de configuracion inicial: deja al negocio listo para recibir reservas, con los errores que mas se repiten en negocios nuevos
// (nadie atiende, sin servicios, horarios que dejan horas abiertas de mas, abono sin Mercado Pago, datos sin completar...).
// Puro: recibe una instantanea del negocio y devuelve el estado de cada paso, en palabras simples. Se prueba sin base de datos.
import { diagnosticar } from "@/lib/oti/diagnostico";
import type { InstantaneaExtendida } from "@/lib/oti/instantanea";

export type NivelPaso = "esencial" | "recomendado" | "opcional";
export interface PasoConfig {
  id: string;
  nivel: NivelPaso;
  titulo: string;
  hecho: boolean;
  problema: boolean;     // algo concreto esta mal (no solo falta hacerlo)
  detalle: string;       // en que estado esta
  consejo: string;       // «lo que mas se olvida»
  ruta?: string;
  manual?: boolean;      // lo marca la persona (el sistema no puede saber si lo hizo)
  pregunta?: string;     // frase para preguntarle a Oti
}

const hhmm = (t: string | null | undefined) => (t ? String(t).slice(0, 5) : "");
const min = (t: string | null | undefined) => { const m = /^(\d{1,2}):(\d{2})/.exec(String(t || "")); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };
const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

// Dias en que el horario del profesional deja abiertas horas que el negocio tiene cerradas (o abre un dia que el negocio cerro).
export function desfasesDeHorario(i: InstantaneaExtendida, barberId: string): string[] {
  const out: string[] = [];
  for (const h of i.horasPro.filter((x) => x.barber_id === barberId && x.is_working)) {
    const n = i.horasNegocio.find((x) => x.day_of_week === h.day_of_week);
    if (!n) continue;
    if (n.is_closed) { out.push(`${DIAS[h.day_of_week]}: el negocio está cerrado y tu horario lo deja abierto`); continue; }
    const pf = min(h.end_time), nf = min(n.close_time), pi = min(h.start_time), ni = min(n.open_time);
    if (pf !== null && nf !== null && pf > nf) out.push(`${DIAS[h.day_of_week]}: el negocio cierra a las ${hhmm(n.close_time)} y tu horario llega hasta las ${hhmm(h.end_time)}`);
    else if (pi !== null && ni !== null && pi < ni) out.push(`${DIAS[h.day_of_week]}: el negocio abre a las ${hhmm(n.open_time)} y tu horario parte a las ${hhmm(h.start_time)}`);
  }
  return out;
}

export function construirChecklist(i: InstantaneaExtendida): PasoConfig[] {
  const pasos: PasoConfig[] = [];
  const publicos = i.servicios.filter((s) => s.active && !s.internal_only);
  const reservables = i.profesionales.filter((p) => p.active && (p.role === "barber" || (p.role === "admin" && p.also_attends_clients)));
  const abiertos = i.horasNegocio.filter((h) => !h.is_closed);

  pasos.push({
    id: "servicios", nivel: "esencial", titulo: "Crea tus servicios", ruta: "/dashboard/servicios", pregunta: "¿Cómo creo un servicio?",
    hecho: publicos.length > 0, problema: publicos.length === 0,
    detalle: publicos.length > 0 ? `Tienes ${publicos.length} ${publicos.length === 1 ? "servicio activo" : "servicios activos"}.` : "Todavía no tienes servicios activos: sin ellos nadie puede reservar.",
    consejo: "Parte con los 3 o 4 que más vendes. Ponle el tiempo real (si dura 45 minutos, 45). Un servicio «interno» no se ve en la reserva.",
  });

  pasos.push({
    id: "atiende", nivel: "esencial", titulo: "Define quién atiende", ruta: "/dashboard/barberos", pregunta: "Quiero atender clientes yo también",
    hecho: reservables.length > 0, problema: reservables.length === 0,
    detalle: reservables.length > 0 ? `Atiende${reservables.length === 1 ? "" : "n"}: ${reservables.map((p) => p.name).join(", ")}.` : "Nadie figura atendiendo clientes: la reserva dirá «no hay profesionales disponibles».",
    consejo: "Si trabajas solo, tu perfil debe tener «atiende clientes» activado (viene así desde el inicio). No te desactives ni te elimines desde Equipo.",
  });

  const negocioSinGuardar = i.horasNegocio.length === 0;
  pasos.push({
    id: "horario-negocio", nivel: "esencial", titulo: "Guarda el horario del negocio", ruta: "/dashboard/configuracion", pregunta: "¿Cómo cambio el horario del negocio?",
    hecho: !negocioSinGuardar && abiertos.length > 0, problema: !negocioSinGuardar && abiertos.length === 0,
    detalle: negocioSinGuardar ? "Aún no lo guardaste: mientras tanto se ofrece de 10:00 a 21:00 todos los días." : abiertos.length === 0 ? "Está cerrado todos los días: nadie puede reservar." : `Abierto ${abiertos.length} ${abiertos.length === 1 ? "día" : "días"} a la semana.`,
    consejo: "Marca como «Cerrado» los días que no trabajas y revisa la hora de cierre de cada día: es la que tus clientes verán como último horario.",
  });

  // Horarios de cada profesional frente al del negocio (el error que mas confunde: aparecen horas que el dueño no programo).
  const desfases = reservables.flatMap((p) => desfasesDeHorario(i, p.id).map((d) => (reservables.length > 1 ? `${p.name} — ${d}` : d)));
  const conHorarioPropio = reservables.some((p) => i.horasPro.some((h) => h.barber_id === p.id));
  pasos.push({
    id: "horario-profesional", nivel: "esencial", titulo: "Revisa el horario de cada profesional", ruta: reservables.length === 1 ? `/dashboard/barberos/${reservables[0].id}` : "/dashboard/barberos", pregunta: "¿Cuál horario manda, el del negocio o el del profesional?",
    hecho: desfases.length === 0, problema: desfases.length > 0,
    detalle: desfases.length > 0 ? `Tus clientes verían horas de más: ${desfases.slice(0, 3).join("; ")}${desfases.length > 3 ? "…" : ""}.` : conHorarioPropio ? "Los horarios de tu equipo calzan con el del negocio." : "Sin horario propio: se usa el del negocio.",
    consejo: "Al abrir Equipo > Horario por primera vez se propone «lunes a sábado de 10 a 20». Si lo guardas sin mirar, esas horas quedan abiertas aunque cierres antes. Revisa la hora de término de cada día y agrega tu colación.",
  });

  const datosFaltan = [!i.datos.logo_url && "logo", !i.datos.phone && "teléfono", !i.datos.address && "dirección"].filter(Boolean) as string[];
  pasos.push({
    id: "datos", nivel: "recomendado", titulo: "Completa los datos de tu negocio", ruta: "/dashboard/configuracion", pregunta: "¿Cómo pongo mi logo?",
    hecho: datosFaltan.length === 0, problema: false,
    detalle: datosFaltan.length === 0 ? "Logo, teléfono y dirección listos." : `Falta: ${datosFaltan.join(", ")}.`,
    consejo: "El logo y los datos aparecen arriba en tu página de reservas y en los correos a tus clientes; el teléfono permite que te escriban por WhatsApp.",
  });

  pasos.push({
    id: "link", nivel: "recomendado", titulo: "Tu link de reserva", ruta: "/dashboard/configuracion", pregunta: "¿Cómo cambio el link de reserva?",
    hecho: !!i.tenant.slug, problema: false,
    detalle: i.tenant.slug ? `re-booking.cl/${i.tenant.slug}` : "Todavía no tienes un link con nombre.",
    consejo: "Puedes cambiar el nombre del link (el anterior sigue funcionando). Cópialo y ponlo en la biografía de Instagram y en tus mensajes de WhatsApp.",
  });

  const ventana = i.tenant.booking_window_days;
  pasos.push({
    id: "dias", nivel: "recomendado", titulo: "Días hacia adelante que pueden reservar", ruta: "/dashboard/configuracion/reservas", pregunta: "¿Con cuántos días de anticipación pueden reservar?",
    hecho: ventana === null || ventana > 1, problema: ventana !== null && ventana <= 1,
    detalle: ventana === null ? "Sin límite especial (se usa el estándar)." : ventana <= 1 ? `Hoy solo se puede reservar con ${ventana} día de anticipación: tus clientes verán casi nada.` : `Se puede reservar hasta ${ventana} días hacia adelante.`,
    consejo: "Lo habitual es entre 14 y 31 días.",
  });

  const abono = i.ajustes.deposit_enabled;
  pasos.push({
    id: "abono", nivel: "opcional", titulo: "Abono para reducir plantones", ruta: "/dashboard/configuracion", pregunta: "Quiero cobrar un abono al reservar",
    hecho: !!abono && i.ajustes.mpConfigurado, problema: !!abono && !i.ajustes.mpConfigurado,
    detalle: !abono ? "No cobras abono (opcional)." : i.ajustes.mpConfigurado ? "Abono activado y Mercado Pago conectado." : "Activaste el abono pero Mercado Pago no está conectado: tus clientes llegan al pago y no pueden pagar.",
    consejo: "Si cobras abono, conecta Mercado Pago en Terminal POS. El cliente tiene unos minutos para pagar; si no paga, el horario se libera solo.",
  });

  // Pasos que solo la persona puede confirmar.
  pasos.push({ id: "probar", nivel: "esencial", titulo: "Prueba tu link como si fueras un cliente", manual: true, hecho: false, problema: false, ruta: i.tenant.slug ? `/${i.tenant.slug}` : undefined,
    detalle: "Ábrelo en una ventana privada y haz una reserva de prueba (la puedes cancelar después).", consejo: "Es la mejor forma de ver exactamente lo que ven tus clientes: los horarios, los servicios y los precios.", pregunta: "Mis clientes no pueden reservar" });
  pasos.push({ id: "compartir", nivel: "recomendado", titulo: "Comparte tu link con tus clientes", manual: true, hecho: false, problema: false, ruta: "/dashboard/configuracion",
    detalle: "Instagram, WhatsApp, tarjeta de presentación.", consejo: "Cada profesional también tiene su propio link en Mi Perfil." });
  pasos.push({ id: "app", nivel: "recomendado", titulo: "Instala la app en tu celular", manual: true, hecho: false, problema: false,
    detalle: "Disponible para iPhone y Android: busca «re-booking».", consejo: "Con la app recibes un aviso cada vez que alguien reserva." });
  return pasos;
}

// Avance: cuenta esenciales y recomendados (los opcionales no restan). `manualesHechos` = pasos que la persona ya marco.
export function avance(pasos: PasoConfig[], manualesHechos: string[] = []): { hechos: number; total: number; porcentaje: number; esencialesPendientes: PasoConfig[] } {
  const cuenta = pasos.filter((p) => p.nivel !== "opcional");
  const esta = (p: PasoConfig) => p.hecho || (!!p.manual && manualesHechos.includes(p.id));
  const hechos = cuenta.filter(esta).length;
  return { hechos, total: cuenta.length, porcentaje: cuenta.length ? Math.round((hechos / cuenta.length) * 100) : 100, esencialesPendientes: pasos.filter((p) => p.nivel === "esencial" && !esta(p)) };
}

// Los hallazgos del diagnostico de reservas, para mostrar junto al checklist (mismo motor que Oti).
export const hallazgosDeReservas = (i: InstantaneaExtendida) => diagnosticar(i);
