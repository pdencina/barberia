// «Re-disparar»: el dueño vuelve a mandar la confirmación a quien todavía no responde.
// Los botones del mensaje nuevo se resuelven por su id, por eso el registro de la entrega pasa a apuntar a él.
import { PROPOSITO_RECORDATORIO_CITA } from "./acciones-cita";
import { enHorarioDeSilencio } from "./horario-silencio";
import { anticipacionCita, conBotonesSegunPlazo, type CitaRecordatorio } from "./recordatorios-whatsapp";
import { hashContactoWhatsApp, normalizarTelefonoWhatsApp, type ResultadoEnvioPlantilla } from "./whatsapp-meta";

export const ESPERA_REDISPARO_MS = 60 * 60000;
export interface Entrega { id: string; provider_accepted_at: string | null }
export interface DepsRedisparo {
  ahora: () => number; sal: string;
  cita: (id: string) => Promise<CitaRecordatorio | null>;
  entrega: (citaId: string) => Promise<Entrega | null>;
  baja: (hash: string) => Promise<boolean>;
  /** Cambia la hora de la entrega solo si sigue siendo la leída (evita dos envíos por doble clic). */
  reclamar: (e: Entrega, ahoraIso: string) => Promise<boolean>;
  devolver: (e: Entrega) => Promise<void>;
  consumirCuota: () => Promise<boolean>;
  enviar: (cita: CitaRecordatorio, para: string, conBotones: boolean) => Promise<ResultadoEnvioPlantilla>;
  anotar: (e: Entrega, proveedor: string) => Promise<void>;
}
export type Respuesta = { ok: true } | { ok: false; status: number; error: string };
const no = (status: number, error: string): Respuesta => ({ ok: false, status, error });
export { PROPOSITO_RECORDATORIO_CITA };

export async function redisparar(citaId: string, tenantId: string, d: DepsRedisparo): Promise<Respuesta> {
  const ahora = d.ahora();
  if (enHorarioDeSilencio(ahora)) return no(409, "Entre las 00:00 y las 06:00 no se envían mensajes");
  const cita = await d.cita(citaId);
  if (!cita || cita.tenant_id !== tenantId) return no(404, "No encuentro la cita");
  if (cita.status !== "scheduled") return no(409, "Esa cita ya no está pendiente de respuesta");
  if (anticipacionCita(cita.start_time, ahora) <= 0) return no(409, "Esa hora ya pasó");
  const para = normalizarTelefonoWhatsApp(cita.client?.phone);
  if (!para) return no(409, "El cliente no tiene un celular válido");
  if (await d.baja(hashContactoWhatsApp(d.sal, tenantId, para))) return no(409, "El cliente pidió no recibir mensajes");
  const e = await d.entrega(citaId);
  if (!e) return no(409, "A esa cita todavía no se le ha enviado la confirmación");
  if (e.provider_accepted_at && ahora - Date.parse(e.provider_accepted_at) < ESPERA_REDISPARO_MS) return no(429, "Se le envió hace menos de 1 hora");
  if (!await d.reclamar(e, new Date(ahora).toISOString())) return no(409, "Ya se está enviando");
  if (!await d.consumirCuota()) { await d.devolver(e); return no(402, "No quedan mensajes disponibles"); }
  const r = await d.enviar(cita, para, conBotonesSegunPlazo(cita.start_time, ahora));
  if (r.estado === "aceptado") { await d.anotar(e, r.id); return { ok: true }; }
  if (r.estado === "fallido") await d.devolver(e); // incierto: pudo salir; se mantiene la espera de 1 hora
  return no(502, r.estado === "fallido" ? "WhatsApp no aceptó el mensaje" : "No se pudo confirmar el envío; revisa antes de reintentar");
}
