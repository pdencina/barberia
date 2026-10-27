// Formulario "Informe de citas por correo" (Mi Perfil): convierte lo que el administrador elige en el cuerpo que acepta
// PUT /api/agente/informe-preferencias, y valida lo minimo antes de enviar. Sin red ni reloj: la fecha de hoy es un parametro.
export type FrecuenciaInforme = "daily" | "every_3_days" | "weekly" | "custom";
export const HORA_INFORME_PREDETERMINADA = "21:00"; // decision de Nico (26 oct. 2026); igual a POLITICA_INFORME.horaPredeterminada
export const DIAS_SEMANA = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"] as const; // 0 = domingo, como el calendario

export interface FormularioInforme {
  enabled: boolean;
  frequency: FrecuenciaInforme;
  weekly_weekday: number | null;
  custom_weekdays: number[];
  send_local_time: string | null;
  anchor_date: string | null;
  effective_from: string | null;
}
export const formularioInicial = (): FormularioInforme => ({
  enabled: false, frequency: "daily", weekly_weekday: null, custom_weekdays: [],
  send_local_time: HORA_INFORME_PREDETERMINADA, anchor_date: null, effective_from: null,
});

// Lo que devuelve la API (puede traer campos nulos o de una preferencia antigua).
export function desdeRespuesta(p: any): FormularioInforme {
  const base = formularioInicial();
  if (!p || typeof p !== "object") return base;
  const hora = typeof p.send_local_time === "string" ? p.send_local_time.slice(0, 5) : null;
  return {
    enabled: p.enabled === true,
    frequency: ["daily", "every_3_days", "weekly", "custom"].includes(p.frequency) ? p.frequency : "daily",
    weekly_weekday: Number.isInteger(p.weekly_weekday) ? p.weekly_weekday : null,
    custom_weekdays: Array.isArray(p.custom_weekdays) ? p.custom_weekdays.filter((d: unknown) => Number.isInteger(d)) : [],
    send_local_time: hora && /^([01]\d|2[0-3]):[0-5]\d$/.test(hora) ? hora : base.send_local_time,
    anchor_date: typeof p.anchor_date === "string" ? p.anchor_date : null,
    effective_from: typeof p.effective_from === "string" ? p.effective_from : null,
  };
}

// Mensaje para el usuario si lo elegido no alcanza para encender el informe; null si esta bien.
export function problemaFormulario(f: FormularioInforme): string | null {
  if (!f.enabled) return null;
  if (!f.send_local_time || !/^([01]\d|2[0-3]):[0-5]\d$/.test(f.send_local_time)) return "Elige una hora válida.";
  if (f.frequency === "weekly" && f.weekly_weekday === null) return "Elige el día de la semana.";
  if (f.frequency === "custom" && f.custom_weekdays.length === 0) return "Elige al menos un día de la semana.";
  return null;
}

// Cuerpo para el PUT: solo campos permitidos, con lo que no aplica a la frecuencia elegida limpio.
// Al encender se fija la vigencia en hoy y, para "cada 3 días", la fecha de partida en hoy (si no tenian una).
export function aCuerpoPut(f: FormularioInforme, hoy: string) {
  return {
    enabled: f.enabled,
    frequency: f.frequency,
    custom_weekdays: f.frequency === "custom" ? Array.from(new Set(f.custom_weekdays)).sort((a, b) => a - b) : [],
    weekly_weekday: f.frequency === "weekly" ? f.weekly_weekday : null,
    anchor_date: f.frequency === "every_3_days" ? f.anchor_date ?? hoy : null,
    send_local_time: f.send_local_time,
    effective_from: f.effective_from ?? (f.enabled ? hoy : null),
  };
}
