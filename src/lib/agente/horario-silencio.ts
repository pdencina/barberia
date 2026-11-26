// De 00:00 a 06:00 (hora de Santiago) el negocio no inicia conversaciones por WhatsApp. Responder a quien escribe sí se puede.
import { obtenerFechaHoraInforme } from "./calendario-informe";

export const HORA_FIN_SILENCIO = 6;
export const enHorarioDeSilencio = (ahora: number) => Number(obtenerFechaHoraInforme(ahora).hora.slice(0, 2)) < HORA_FIN_SILENCIO;
