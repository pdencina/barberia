import { parseWallClock } from "../wallclock";
import type { CitaRecordatorio } from "./recordatorios-whatsapp";
// UTC solo conserva los campos de pared chilenos; NO convierte una cita a instante real.
const fecha = new Intl.DateTimeFormat("es-CL",{timeZone:"UTC",weekday:"long",day:"numeric",month:"long"});
export function variablesPlantillaRecordatorio(c:CitaRecordatorio):readonly string[]{
 const d=parseWallClock(c.start_time);
 if(!Number.isFinite(d.getTime()))throw new Error("Fecha de cita inválida");
 const hora=`${String(d.getUTCHours()).padStart(2,"0")}:${String(d.getUTCMinutes()).padStart(2,"0")}`;
 return [`${fecha.format(d)}, ${hora}`,hora,c.barber?.name||"Tu profesional",c.services.map(s=>s.service?.name).filter(Boolean).join(", ")||"Servicio"];
}
