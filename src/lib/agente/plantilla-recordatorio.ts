import { parseWallClock } from "../wallclock";
import { horaAmPm } from "../hora-ampm";
import type { CitaRecordatorio } from "./recordatorios-whatsapp";
// UTC solo conserva los campos de pared chilenos; NO convierte una cita a instante real.
const fecha = new Intl.DateTimeFormat("es-CL",{timeZone:"UTC",weekday:"long",day:"numeric",month:"long"});
export function variablesPlantillaRecordatorio(c:CitaRecordatorio):readonly string[]{
 const d=parseWallClock(c.start_time);
 if(!Number.isFinite(d.getTime()))throw new Error("Fecha de cita inválida");
 const hora=horaAmPm(`${String(d.getUTCHours()).padStart(2,"0")}:${String(d.getUTCMinutes()).padStart(2,"0")}`);
 const parts=fecha.formatToParts(d),part=(type:string)=>parts.find(p=>p.type===type)!.value;
 return [`${part("weekday")} ${part("day")} de ${part("month")}, ${hora}`,hora,c.barber?.name||"Tu profesional",c.services.map(s=>s.service?.name).filter(Boolean).join(", ")||"Servicio"];
}

// ---- Confirmación por WhatsApp (plantillas confirmacion_cita_botones y cita_agendada_aviso, 6 variables en el mismo orden).
export const PLANTILLA_CONFIRMACION_BOTONES = "confirmacion_cita_botones";
export const PLANTILLA_CITA_AVISO = "cita_agendada_aviso";
export const IDIOMA_PLANTILLAS_CONFIRMACION = "es";
/** Respuestas que devuelven los botones, en el orden de la plantilla: confirmar, cancelar, modificar. */
export const BOTONES_CONFIRMACION = ["confirmo mi cita", "cancelo mi cita", "modificar mi cita"] as const;
const fechaLarga = new Intl.DateTimeFormat("es-CL",{timeZone:"UTC",weekday:"long",day:"numeric",month:"long"});
const primerNombre = (n:string|null|undefined)=>{const t=String(n??"").trim().split(/\s+/)[0]??"";return t?t.charAt(0).toUpperCase()+t.slice(1).toLowerCase():"cliente";};
/** [nombre, negocio, servicio, profesional, "miércoles, 25 de noviembre", "08:30"] */
export function variablesPlantillaConfirmacion(c:CitaRecordatorio,negocio:string):readonly string[]{
 const d=parseWallClock(c.start_time);
 if(!Number.isFinite(d.getTime()))throw new Error("Fecha de cita inválida");
 const hora=horaAmPm(`${String(d.getUTCHours()).padStart(2,"0")}:${String(d.getUTCMinutes()).padStart(2,"0")}`);
 const parts=fechaLarga.formatToParts(d),part=(type:string)=>parts.find(p=>p.type===type)!.value;
 return [primerNombre(c.client?.name),negocio||"el negocio",c.services.map(s=>s.service?.name).filter(Boolean).join(", ")||"tu servicio",c.barber?.name||"tu profesional",`${part("weekday")}, ${part("day")} de ${part("month")}`,hora];
}

/** Texto que recibe el cliente con cada plantilla de confirmación (para el registro de chats; debe calzar con lo aprobado en Meta). */
export function textoPlantillaConfirmacion(conBotones:boolean,v:readonly string[]):string{
 return conBotones
  ?`Hola ${v[0]}! Te escribimos desde ${v[1]} para confirmar tu hora de ${v[2]} con ${v[3]} el ${v[4]} a las ${v[5]}. ¿Nos confirmas si asistirás? ¡Gracias!\n[Botones: Sí, confirmo mi cita · No, deseo cancelar mi cita · Modificar mi cita]`
  :`Hola ${v[0]}! Tu hora en ${v[1]} quedó agendada: ${v[2]} con ${v[3]} el ${v[4]} a las ${v[5]}. Te recomendamos llegar unos minutos antes. Si necesitas ayuda con tu hora, puedes escribirnos por este mismo chat. ¡Te esperamos!`;
}

/** Segundo mensaje, con los mismos 3 botones. Variables de la confirmación + la hora límite. Debe calzar con lo aprobado en Meta. */
export const PLANTILLA_ULTIMO_AVISO = "confirmacion_cita_ultimo_aviso";
export const textoPlantillaUltimoAviso = (v: readonly string[]) =>
 `Hola ${v[0]}! Aún no recibimos tu confirmación en ${v[1]} para ${v[2]} con ${v[3]} el ${v[4]} a las ${v[5]}. Si no respondes antes de las ${v[6]}, tu hora se cancelará. ¿Nos confirmas si asistirás?\n[Botones: Sí, confirmo mi cita · No, deseo cancelar mi cita · Modificar mi cita]`;
