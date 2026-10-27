// INFERENCIA: política provisional solicitada para revisión; Nico NO la confirmó.
// ÚNICO lugar para cambiar día informado y hora por defecto (preguntas 16/21).
export const POLITICA_PROVISIONAL_INFORME = Object.freeze({
  diasAntes: 1,
  horaPredeterminada: "08:00",
});

export interface PreferenciaCalendarioInforme {
  enabled: boolean;
  frequency: "daily" | "every_3_days" | "weekly" | "custom";
  custom_weekdays: readonly number[];
  weekly_weekday: number | null;
  anchor_date: string | null;
  send_local_time: string | null;
  effective_from: string | null;
}
export type DecisionCalendarioInforme =
  | { toca: true; fechaInformada: string; fechaProgramada: string }
  | { toca: false; motivo: "apagado" | "fuera_de_calendario" | "antes_de_hora" | "ya_informado" };

const DIA_CIVIL = 86_400_000; // aritmética de calendario, nunca 24h reales de Chile
const pad = (n: number, width = 2) => String(n).padStart(width, "0");
function ordinal(value: string): number {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("Fecha inválida");
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(0);
  date.setUTCFullYear(y, m - 1, d);
  date.setUTCHours(0, 0, 0, 0);
  if (y < 1 || date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) throw new Error("Fecha inválida");
  return date.getTime() / DIA_CIVIL;
}
function civil(day: number): string {
  const d = new Date(day * DIA_CIVIL);
  const result = `${pad(d.getUTCFullYear(), 4)}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  ordinal(result);
  return result;
}
function segundos(value: string): number {
  if (!/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(value)) throw new Error("Hora inválida");
  const [h, m, s = 0] = value.split(":").map(Number);
  return h * 3600 + m * 60 + s;
}
function validar(p: PreferenciaCalendarioInforme): void {
  if (!p || typeof p.enabled !== "boolean" || !["daily", "every_3_days", "weekly", "custom"].includes(p.frequency)) throw new Error("Preferencia inválida");
  if (p.effective_from !== null) ordinal(p.effective_from);
  else if (p.enabled) throw new Error("Falta fecha de vigencia");
  if (p.anchor_date !== null) ordinal(p.anchor_date);
  if (p.enabled && p.frequency === "every_3_days" && p.anchor_date === null) throw new Error("Falta fecha ancla");
  if (p.frequency === "weekly" && (p.weekly_weekday !== null || p.enabled) && (!Number.isInteger(p.weekly_weekday) || p.weekly_weekday! < 0 || p.weekly_weekday! > 6)) throw new Error("Día semanal inválido");
  if (!Array.isArray(p.custom_weekdays) || p.custom_weekdays.some(d => !Number.isInteger(d) || d < 0 || d > 6) || new Set(p.custom_weekdays).size !== p.custom_weekdays.length) throw new Error("Días personalizados inválidos");
  if (p.enabled && p.frequency === "custom" && p.custom_weekdays.length === 0) throw new Error("Elige días personalizados");
  if (p.send_local_time !== null) segundos(p.send_local_time);
}
function corresponde(p: PreferenciaCalendarioInforme, day: number): boolean {
  if (!p.enabled || day < ordinal(p.effective_from!)) return false;
  const weekday = ((day + 4) % 7 + 7) % 7;
  switch (p.frequency) {
    case "daily": return true;
    case "weekly": return weekday === p.weekly_weekday;
    case "custom": return p.custom_weekdays.includes(weekday);
    case "every_3_days": {
      const distance = day - ordinal(p.anchor_date!);
      return distance >= 0 && distance % 3 === 0;
    }
  }
}

// Enumera fechas civiles debidas, NO autoriza recuperar/reintentar atrasos (#22).
export function enumerarFechasInforme(p: PreferenciaCalendarioInforme, desde: string, hasta: string): string[] {
  validar(p);
  const start = ordinal(desde), end = ordinal(hasta);
  if (end < start) throw new Error("Intervalo inválido");
  const dates: string[] = [];
  if (!p.enabled) return dates;
  for (let day = Math.max(start, ordinal(p.effective_from!)); day <= end; day++) {
    if (corresponde(p, day)) dates.push(civil(day));
  }
  return dates;
}

const formato = new Intl.DateTimeFormat("en-GB", {
  timeZone: "America/Santiago", year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
});

// Pura: ahora es un instante UTC en milisegundos suministrado por el llamador.
// No usa reloj, base, red, entorno ni fechas de citas. Última fecha = informe ya aceptado.
// INFERENCIA IA3: evalúa desde la hora elegida hasta el fin de esa fecha civil;
// una hora inexistente se vuelve elegible en la primera pasada posterior del día.
// Revisión de configuración y reserva atómica se hacen fuera de esta función.
export function decidirInforme(
  p: PreferenciaCalendarioInforme, ahora: number, ultimaFechaInformada: string | null,
): DecisionCalendarioInforme {
  validar(p);
  if (!Number.isFinite(ahora) || !Number.isFinite(new Date(ahora).getTime())) throw new Error("Instante inválido");
  if (ultimaFechaInformada !== null) ordinal(ultimaFechaInformada);
  if (!p.enabled) return { toca: false, motivo: "apagado" };
  const parts = formato.formatToParts(new Date(ahora));
  const part = (type: string) => parts.find(p => p.type === type)!.value;
  const fechaProgramada = `${part("year").padStart(4, "0")}-${part("month")}-${part("day")}`;
  const day = ordinal(fechaProgramada);
  if (!corresponde(p, day)) return { toca: false, motivo: "fuera_de_calendario" };
  const horaActual = segundos(`${part("hour")}:${part("minute")}:${part("second")}`);
  if (horaActual < segundos(p.send_local_time ?? POLITICA_PROVISIONAL_INFORME.horaPredeterminada)) return { toca: false, motivo: "antes_de_hora" };
  const fechaInformada = civil(day - POLITICA_PROVISIONAL_INFORME.diasAntes);
  if (ultimaFechaInformada !== null && ordinal(ultimaFechaInformada) >= ordinal(fechaInformada)) return { toca: false, motivo: "ya_informado" };
  return { toca: true, fechaInformada, fechaProgramada };
}
