// Motivos de cancelación, quién cancela y recomendaciones del Dashboard. Puro: se prueba sin base de datos.

export interface Opcion { v: string; l: string }

// Cuando cancela el equipo (administrador, recepción o profesional).
export const MOTIVOS_EQUIPO: Opcion[] = [
  { v: "cliente_aviso", l: "El cliente avisó que no puede" },
  { v: "profesional", l: "El profesional no puede atender" },
  { v: "error", l: "Error al agendar o cita duplicada" },
  { v: "cambio_hora", l: "Se reagendó para otro día u hora" },
  { v: "otro", l: "Otro motivo" },
];

// Cuando cancela el propio cliente desde su link.
export const MOTIVOS_CLIENTE: Opcion[] = [
  { v: "imprevisto", l: "Tuve un imprevisto" },
  { v: "otro_horario", l: "Quiero cambiar de horario" },
  { v: "otro_lugar", l: "Me atendí en otro lugar" },
  { v: "no_necesito", l: "Ya no lo necesito" },
  { v: "otro", l: "Otro motivo" },
];

const ETIQUETA = new Map([...MOTIVOS_EQUIPO, ...MOTIVOS_CLIENTE].map((o) => [o.v, o.l]));
export const etiquetaMotivo = (v: string | null | undefined) => (v ? ETIQUETA.get(v) || "Otro motivo" : "Sin motivo registrado");

const QUIEN: Record<string, string> = { client: "El cliente", admin: "Administrador", receptionist: "Recepción", barber: "El profesional", super_admin: "Administrador", system: "El sistema" };
export const etiquetaQuien = (v: string | null | undefined) => (v ? QUIEN[v] || "Equipo" : "Sin registrar");

// Solo valores conocidos entran a la base (el texto libre del navegador no se guarda).
export const motivoValido = (v: unknown): string | null => (typeof v === "string" && ETIQUETA.has(v) ? v : null);

export interface FilaCancelada { status: string; cancelled_by?: string | null; cancel_reason?: string | null }
export interface ResumenCancelaciones {
  total: number;          // canceladas + no llegaron
  canceladas: number;
  noLlegaron: number;
  porQuien: { quien: string; nombre: string; n: number }[];
  motivos: { motivo: string; nombre: string; n: number }[];
  sinRegistro: number;    // canceladas sin quién/motivo (antes de que existiera el registro)
}

export function resumirCancelaciones(rows: FilaCancelada[]): ResumenCancelaciones {
  const canc = rows.filter((r) => r.status === "cancelled");
  const noLlegaron = rows.filter((r) => r.status === "no_show").length;
  const quien = new Map<string, number>(), mot = new Map<string, number>();
  let sinRegistro = 0;
  for (const r of canc) {
    if (!r.cancelled_by && !r.cancel_reason) sinRegistro++;
    quien.set(r.cancelled_by || "?", (quien.get(r.cancelled_by || "?") || 0) + 1);
    mot.set(r.cancel_reason || "?", (mot.get(r.cancel_reason || "?") || 0) + 1);
  }
  const ordenar = <T extends { n: number }>(a: T[]) => a.sort((x, y) => y.n - x.n);
  return {
    total: rows.length, canceladas: canc.length, noLlegaron,
    porQuien: ordenar(Array.from(quien.entries()).map(([k, n]) => ({ quien: k, nombre: etiquetaQuien(k === "?" ? null : k), n }))),
    motivos: ordenar(Array.from(mot.entries()).map(([k, n]) => ({ motivo: k, nombre: etiquetaMotivo(k === "?" ? null : k), n }))),
    sinRegistro,
  };
}

export interface Consejo { titulo: string; texto: string; enlace?: { href: string; label: string } }

export interface EntradaConsejos {
  reservas: number; confirmadas: number; clientesNuevos: number;
  reservasCambio: number; clientesCambio: number; cancelacionesCambio: number;
  cancel: ResumenCancelaciones;
}

// Recomendaciones según los números del día. Cada una explica qué hacer; no se inventa nada que el sistema no pueda hacer.
export function consejosCancelaciones(e: EntradaConsejos): Consejo[] {
  const c = e.cancel, out: Consejo[] = [];
  if (c.total === 0) return [{ titulo: "Sin cancelaciones", texto: "Hoy no hay citas canceladas ni clientes que no llegaron. Mantén los recordatorios activos para seguir así." }];
  if (c.noLlegaron > 0)
    out.push({ titulo: "Clientes que no llegaron", texto: "Envía un recordatorio el día antes (WhatsApp o correo) y pide confirmar. Si se repite, un abono al reservar reduce mucho las faltas.", enlace: { href: "/dashboard/configuracion/reservas", label: "Configurar abono" } });
  const cliente = c.porQuien.find((q) => q.quien === "client")?.n || 0;
  if (c.canceladas > 0 && cliente / c.canceladas >= 0.6)
    out.push({ titulo: "Cancelan sobre todo los clientes", texto: "Activa la lista de espera para llenar rápido el hueco y deja claro el plazo de cancelación en la reserva." });
  const equipo = c.canceladas - cliente - c.sinRegistro;
  if (c.canceladas > 0 && equipo / c.canceladas >= 0.3)
    out.push({ titulo: "Parte importante las cancela el equipo", texto: "Bloquea con anticipación los horarios en que un profesional no puede atender (vacaciones, permisos) para que nadie reserve ahí." });
  if (c.canceladas > 0 && c.sinRegistro / c.canceladas >= 0.5)
    out.push({ titulo: "Falta el motivo", texto: "Al cancelar una cita, elige siempre el motivo. Con unas semanas de datos verás por qué se cae la agenda y qué corregir." });
  if (e.cancelacionesCambio >= 30)
    out.push({ titulo: "Subieron las cancelaciones", texto: `Hay un ${e.cancelacionesCambio}% más que ayer. Revisa si coincide con un cambio de horarios o precios.` });
  return out.length ? out : [{ titulo: "Dentro de lo normal", texto: "Las cancelaciones de hoy no muestran un patrón preocupante. Sigue registrando el motivo para detectar cambios." }];
}

export function consejosConfirmadas(e: EntradaConsejos): Consejo[] {
  const activas = Math.max(e.reservas - e.cancel.total, 0);
  const tasa = activas > 0 ? e.confirmadas / activas : 0;
  if (activas === 0) return [{ titulo: "Sin citas por confirmar", texto: "Cuando haya citas agendadas, aquí verás cuántas ya confirmaron su asistencia." }];
  const out: Consejo[] = [];
  if (tasa < 0.5) out.push({ titulo: "Pocas citas confirmadas", texto: "Menos de la mitad confirmó. Envía el recordatorio por WhatsApp el día antes con el botón de confirmar: baja las faltas y te deja reorganizar horarios a tiempo.", enlace: { href: "/dashboard/recordatorios", label: "Ver recordatorios" } });
  else out.push({ titulo: "Buena confirmación", texto: "La mayoría ya confirmó. Las citas sin confirmar son las que conviene llamar o escribir primero." });
  return out;
}

export function consejosReservas(e: EntradaConsejos): Consejo[] {
  if (e.reservasCambio <= -20) return [{ titulo: "Baja de reservas", texto: "Hay bastantes menos citas que ayer. Revisa horarios libres, comparte tu link en redes y considera una promoción para las horas más lentas.", enlace: { href: "/dashboard/demanda", label: "Ver mapa de demanda" } }];
  if (e.reservasCambio >= 20) return [{ titulo: "Buen día de reservas", texto: "Subieron las citas. Revisa que cada profesional tenga sus horarios al día para no sobrecargar a nadie." }];
  return [{ titulo: "Sin cambios importantes", texto: "Las reservas están parecidas a ayer. El mapa de demanda te muestra qué horas conviene reforzar.", enlace: { href: "/dashboard/demanda", label: "Ver mapa de demanda" } }];
}

export function consejosClientesNuevos(e: EntradaConsejos): Consejo[] {
  if (e.clientesNuevos === 0) return [{ titulo: "Sin clientes nuevos", texto: "Comparte tu link de reservas en Instagram y WhatsApp, y pide reseñas a quienes ya vienen: las reseñas traen gente nueva.", enlace: { href: "/dashboard/resenas", label: "Ver reseñas" } }];
  if (e.clientesCambio <= -30) return [{ titulo: "Llegan menos clientes nuevos", texto: "Pide a tus clientes frecuentes que recomienden; un beneficio por referido suele funcionar." }];
  return [{ titulo: "Van llegando clientes nuevos", texto: "Lo importante ahora es que vuelvan: revisa en Retención a quienes llevan tiempo sin venir.", enlace: { href: "/dashboard/retencion", label: "Ver retención" } }];
}

const CANAL: Record<string, string> = { link: "desde el link de su cita", portal: "desde su portal de cliente", panel: "desde el panel" };

// «Quién» de una cancelación, lo más exacto posible: la cuenta (nombre y rol) si fue desde el panel, o el cliente y por dónde entró.
export function textoQuienCancelo(f: { cancelled_by?: string | null; cancel_channel?: string | null; userName?: string | null }): string {
  if (f.cancelled_by === "client") return `El cliente ${CANAL[f.cancel_channel || "link"] || "desde su link"}`;
  if (f.userName) return `${f.userName} (${etiquetaQuien(f.cancelled_by).toLowerCase()})`;
  if (f.cancelled_by) return `${etiquetaQuien(f.cancelled_by)} (cuenta no identificada)`;
  return "Sin registrar (se canceló antes de guardar este dato)";
}

export interface CancelacionFila { hora: string; cliente: string; profesional: string; estado: "cancelled" | "no_show"; quien: string; motivo: string; nota?: string | null; cuando?: string; aviso?: string | null; sospechosa?: boolean }

// ---- reglas de la cancelación hecha por el equipo ----
export const NOTA_MINIMA = 5;

// Sin motivo no se cancela; y «Otro motivo» exige escribir cuál fue (para poder analizarlo después).
export function errorMotivoEquipo(reason: unknown, note: unknown): string | null {
  const m = motivoValido(reason);
  if (!m) return "Elige el motivo de la cancelación.";
  if (m === "otro" && (limpiarNota(note) || "").length < NOTA_MINIMA) return `Escribe cuál fue el motivo (al menos ${NOTA_MINIMA} letras).`;
  return null;
}
export const limpiarNota = (n: unknown): string | null => {
  const t = String(n ?? "").replace(/\s+/g, " ").trim().slice(0, 300);
  return t || null;
};

// Cancelaciones causadas por el equipo (no por el cliente): no deben bajar la asistencia del cliente en su ficha.
export const CAUSAS_DEL_EQUIPO = new Set(["profesional", "error", "cambio_hora"]);
export function afectaAsistencia(a: { status: string; cancel_reason?: string | null }): boolean {
  if (a.status === "no_show") return true;
  if (a.status === "cancelled") return !CAUSAS_DEL_EQUIPO.has(String(a.cancel_reason || ""));
  return false;
}

// «No llegó» solo se puede marcar cuando la cita ya empezó (ambas horas en hora de pared de Chile, como se guardan las citas).
export function puedeMarcarNoLlego(inicioPared: Date, ahoraPared: Date): boolean {
  return ahoraPared.getTime() >= inicioPared.getTime();
}
// Convierte un instante real a la hora de pared de Chile escrita como UTC (el formato de las citas).
export function aHoraPared(d: Date): Date {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(d);
  const g = (t: string) => Number(p.find((x) => x.type === t)?.value);
  return new Date(Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute"), g("second")));
}

const hhmm = (d: Date) => `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
// «Se registró a las 14:05 (2 h 25 min antes de la cita)» o «… 5 min después de la hora de la cita».
export function textoMomento(registroInstante: Date | null, inicioPared: Date | null): { cuando: string; aviso: string | null } {
  if (!registroInstante || !inicioPared) return { cuando: "", aviso: null };
  const reg = aHoraPared(registroInstante);
  const dif = Math.round((inicioPared.getTime() - reg.getTime()) / 60000); // + = antes de la cita
  const dur = (m: number) => { const a = Math.abs(m); return a >= 60 ? `${Math.floor(a / 60)} h${a % 60 ? ` ${a % 60} min` : ""}` : `${a} min`; };
  const aviso = dif > 0 ? `${dur(dif)} antes de la hora de la cita` : dif < 0 ? `${dur(dif)} después de la hora de la cita` : "justo a la hora de la cita";
  return { cuando: hhmm(reg), aviso };
}
