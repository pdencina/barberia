import { hashContactoWhatsApp, normalizarTelefonoWhatsApp } from "./whatsapp-meta";
import { obtenerFechaHoraInforme } from "./calendario-informe";
import { parseWallClock } from "../wallclock";
export interface Cliente {id:string;tenant_id:string;phone:unknown}
export interface Registro {id:string;tenant_id:string;appointment_id:string;channel:string;purpose:string;status:string;provider_accepted_at:string;provider_message_id:string|null;appointment:{id:string;tenant_id:string;client_id:string;start_time:string}}
// Única definición de ventana/futuro/aislamiento; se usa ANTES de cargar clientes y en el selector.
export function recordatoriosCandidatos(tenant:string,ahora:number,records:Registro[]):Registro[]{
 if(!tenant||tenant==="ALL"||!Number.isFinite(ahora))return [];
 const local=obtenerFechaHoraInforme(ahora);
 const pared=parseWallClock(`${local.fecha}T${local.hora}:${String(local.segundos%60).padStart(2,"0")}.${String(((ahora%1000)+1000)%1000).padStart(3,"0")}Z`).getTime();
 return records.filter(r=>{
  const a=r.appointment,accepted=Date.parse(r.provider_accepted_at);
  return r.tenant_id===tenant&&r.channel==="whatsapp"&&r.purpose==="recordatorio-cita-v1"&&r.status==="aceptado_proveedor"
   &&Number.isFinite(accepted)&&accepted>=ahora-48*3600000&&accepted<=ahora&&a?.tenant_id===tenant
   &&a.id===r.appointment_id&&parseWallClock(a.start_time).getTime()>pared;
 });
}
// Solo datos de servidor. El repositorio carga clientes candidatos y comprueba además
// ambigüedad global por HEAD/conteo: un cliente sin recordatorio también puede compartir teléfono.
export function seleccionarRecordatorioUnico(tenant:string,hash:string,ahora:number,clients:Cliente[],records:Registro[],sal:string){
 if(!tenant||tenant==="ALL"||!sal.trim()||!Number.isFinite(ahora))return null;
 const ids=new Set(clients.filter(c=>{
  const phone=normalizarTelefonoWhatsApp(c.phone);
  return c.tenant_id===tenant&&phone&&hashContactoWhatsApp(sal,tenant,phone)===hash;
 }).map(c=>c.id));
 if(ids.size!==1)return null;
 const clientId=Array.from(ids)[0];
 const matches=recordatoriosCandidatos(tenant,ahora,records).filter(r=>r.appointment.client_id===clientId);
 if(matches.length!==1||!matches[0].provider_message_id)return null;
 return {registroId:matches[0].id,clienteId:clientId};
}

// Patrón inverso EXACTO de normalizarTelefonoWhatsApp/formatPhoneCL, no del hash.
// Incluye las variantes sin país/cero troncal y conserva países explícitos con +.
// Los separadores son el conjunto ECMAScript \s más ()- que elimina el normalizador.
export function patronTelefonoCanonico(canonico:string):string{
 if(!/^[0-9]{1,32}$/.test(canonico))throw new Error("Teléfono canónico inválido");
 const formas=new Set(["+"+canonico,"0+"+canonico]);
 if(canonico.startsWith("56")){
  const bases=[canonico],local=canonico.slice(2);
  if(local&&!local.startsWith("56"))bases.push(local);
  for(const base of bases){if(!base.startsWith("0"))formas.add(base);formas.add("0"+base);}
 }
 const espacios="\t\n\v\f\r \u00a0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u2028\u2029\u202f\u205f\u3000\ufeff";
 const permitidos=`[0-9+${espacios}()-]`;
 // Validación global una sola vez: evita repetir la clase Unicode en cada dígito del URL.
 const sep="[^0-9+]*";
 const cuerpo=Array.from(formas,f=>Array.from(f,c=>c==="+"?"\\+":c).join(sep)).join("|");
 return `^(?=${permitidos}*$)${sep}(?:${cuerpo})${sep}$`;
}
