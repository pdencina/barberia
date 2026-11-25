// Los profesionales con arriendo de estación solo pueden cambiar su horario y sus días libres los domingos y lunes (hora de Chile).
// Así la semana queda ordenada y nadie mueve horarios "en vivo" con clientes ya agendados.
export const DIAS_EDICION_ARRIENDO = [0, 1]; // 0 = domingo, 1 = lunes

export function diaDeLaSemanaChile(ahora: Date = new Date()): number {
  const d = new Intl.DateTimeFormat("en-US", { timeZone: "America/Santiago", weekday: "short" }).format(ahora);
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(d);
}

export function arriendoPuedeEditarHoy(ahora?: Date): boolean {
  return DIAS_EDICION_ARRIENDO.includes(diaDeLaSemanaChile(ahora));
}

export const MENSAJE_HORARIO_BLOQUEADO = "Tu horario solo se puede cambiar los domingos y lunes, para toda la semana. Hoy puedes verlo, pero no modificarlo.";
