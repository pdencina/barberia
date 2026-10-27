import { hashContactoWhatsApp, normalizarTelefonoWhatsApp } from "./whatsapp-meta";
import { obtenerFechaHoraInforme } from "./calendario-informe";
import { parseWallClock } from "../wallclock";
interface Cliente {id:string;tenant_id:string;phone:unknown}
interface Registro {id:string;tenant_id:string;appointment_id:string;channel:string;purpose:string;status:string;provider_accepted_at:string;provider_message_id:string|null;appointment:{id:string;tenant_id:string;client_id:string;start_time:string}}
// Solo datos resueltos por servidor. Un teléfono compartido entre perfiles de cliente NO identifica uno.
export function seleccionarRecordatorioUnico(tenant:string,hash:string,ahora:number,clients:Cliente[],records:Registro[],sal:string){
 if(!tenant||tenant==="ALL"||!sal.trim()||!Number.isFinite(ahora))return null;
 const ids=new Set(clients.filter(c=>{
  const phone=normalizarTelefonoWhatsApp(c.phone);
  return c.tenant_id===tenant&&phone&&hashContactoWhatsApp(sal,tenant,phone)===hash;
 }).map(c=>c.id));
 if(ids.size!==1)return null;
 const clientId=Array.from(ids)[0],local=obtenerFechaHoraInforme(ahora);
 const pared=parseWallClock(`${local.fecha}T${local.hora}:${String(local.segundos%60).padStart(2,"0")}.${String(ahora%1000).padStart(3,"0")}Z`).getTime();
 const matches=records.filter(r=>{
  const a=r.appointment,accepted=Date.parse(r.provider_accepted_at);
  return r.tenant_id===tenant&&r.channel==="whatsapp"&&r.purpose==="recordatorio-cita-v1"&&r.status==="aceptado_proveedor"
   &&Number.isFinite(accepted)&&accepted>=ahora-48*3600000&&accepted<=ahora&&a?.tenant_id===tenant&&a.client_id===clientId
   &&a.id===r.appointment_id&&parseWallClock(a.start_time).getTime()>pared;
 });
 if(matches.length!==1||!matches[0].provider_message_id)return null;
 return {registroId:matches[0].id,clienteId:clientId};
}
