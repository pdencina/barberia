// Cuándo se envía la confirmación, el aviso de "no has respondido" y la cancelación. Funciones puras.
// Todas las horas son "hora de pared de Santiago escrita como UTC" (milisegundos), igual que appointments.start_time.
const H = 3600000;
export const HORAS_ENVIO_CONFIRMACION = 8;
/** Máximo de anticipación con que puede salir una confirmación (reserva de noche para el día siguiente). */
export const HORAS_VENTANA_CONFIRMACION = 27;
const dia = (ms: number) => Math.floor(ms / (24 * H)) * 24 * H;
const hora = (ms: number) => (ms - dia(ms)) / H;
const deNoche = (ms: number) => hora(ms) >= 21 || hora(ms) < 6;

/** ¿Ya corresponde enviar la confirmación? (El silencio de 00:00 a 06:00 se aplica aparte.) */
export function tocaConfirmar(inicio: number, creada: number | null, ahora: number): boolean {
  if (!(inicio > ahora)) return false;
  // Reservada de noche (21:00 a 06:00) para esa misma jornada o la siguiente: al momento.
  if (creada !== null && deNoche(creada) && dia(inicio) <= dia(creada) + (hora(creada) >= 21 ? 24 * H : 0)) return inicio - ahora <= HORAS_VENTANA_CONFIRMACION * H;
  // Citas entre 05:00 y 14:00: las 8 horas caerían de noche, así que salen el día anterior a las 21:00.
  if (hora(inicio) >= 5 && hora(inicio) < 14) return ahora >= dia(inicio) - 3 * H;
  return inicio - ahora <= HORAS_ENVIO_CONFIRMACION * H;
}

/** ¿Ya corresponde avisar que, sin respuesta, la hora se cancelará? */
export function tocaAvisar(c: { inicio: number; creada: number | null; enviada: number }, ahora: number): boolean {
  const { inicio, creada, enviada } = c;
  // Nunca se amenaza con cancelar una hora reservada con menos de 3 h, ni una que empiece a 1 h o menos de la cancelación.
  if (creada === null || inicio - creada < 3 * H || inicio - ahora <= 2 * H) return false;
  if (ahora - enviada > 18 * H) return false;
  const nocturna = deNoche(creada) && enviada - creada < 10 * H;
  let desde = enviada + H;
  if (nocturna) desde = dia(creada) + (hora(creada) >= 21 ? 24 * H : 0) + 8 * H;
  else if (hora(enviada) >= 22) desde = dia(enviada) + 32 * H;
  // A las 23:00 o después no se avisa: la cancelación caería de madrugada.
  return ahora >= desde && hora(ahora) >= (nocturna ? 8 : 6) && hora(ahora) < 23;
}

/** ¿Ya pasó la hora de espera tras el aviso y todavía tiene sentido liberar el cupo? */
export function tocaCancelar(c: { inicio: number; avisada: number }, ahora: number): boolean {
  return ahora - c.avisada >= H && ahora - c.avisada <= 12 * H && c.inicio - ahora >= 45 * 60000 && hora(ahora) >= 6;
}
