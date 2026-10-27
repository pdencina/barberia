import { fetchAllRows } from "../accounting";
import { obtenerFechaHoraInforme } from "./calendario-informe";
import { hashContactoWhatsApp, type ResultadoEnvioPlantilla } from "./whatsapp-meta";
import { PROPOSITO_RECORDATORIO_CITA } from "./acciones-cita";

// INFERENCIA: cota técnica por invocación; no reemplaza cuota del negocio.
export const MAX_ENVIOS_RECORDATORIOS = 20;
export interface NegocioRecordatorios { tenantId: string; phoneNumberId: string; enabled: boolean }
export interface CitaRecordatorio {
  id: string; tenant_id: string; status: string; start_time: string; date: string; reminder_sent: boolean;
  client: { id: string; tenant_id: string; name: string; phone: string | null; email: string | null } | null;
  barber: { name: string } | null;
  services: { service: { name: string } | null }[];
}
type Canal = "whatsapp" | "email";
type Final = "aceptado_proveedor" | "fallido" | "incierto";
export class MigracionRecordatoriosPendiente extends Error { constructor() { super("Falta aplicar la migración 005"); } }
export interface RepositorioRecordatorios {
  negocios: () => Promise<NegocioRecordatorios[]>;
  negocio: (tenant: string) => Promise<NegocioRecordatorios | null>;
  citas: (tenant: string, ventana: {desde:string;hasta:string}) => Promise<CitaRecordatorio[]>;
  actual: (c: CitaRecordatorio) => Promise<CitaRecordatorio | null>;
  baja: (tenant: string, hash: string) => Promise<boolean>;
  existe: (c: CitaRecordatorio, canal: Canal) => Promise<boolean>;
  reclamar: (c: CitaRecordatorio, canal: Canal, ahora: number) => Promise<string | null>;
  finalizar: (c: CitaRecordatorio, canal: Canal, id: string, estado: Final, ahora: number, proveedor?: string) => Promise<void>;
  // Puente conservador: impide nuevas lecturas del cron antiguo; NO protege su snapshot ya leído.
  reservarContraCronCorreo: (c: CitaRecordatorio, ahora: number) => Promise<boolean>;
}
export interface DependenciasRecordatorios {
  repo: RepositorioRecordatorios; ahora: () => number; sal: string;
  tieneCuota: (tenant: string, canal: Canal) => Promise<boolean>;
  consumirCuota: (tenant: string, canal: Canal, citaId: string) => Promise<boolean>;
  enviarWhatsApp: (n: NegocioRecordatorios, c: CitaRecordatorio, para: string) => Promise<ResultadoEnvioPlantilla>;
  enviarCorreo: (c: CitaRecordatorio) => Promise<ResultadoEnvioPlantilla>;
}
const json = (body:unknown,status=200) => new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json","Cache-Control":"no-store"}});
// 20..28 horas reales (misma amplitud del cron existente), expresadas en el formato
// de las citas: hora de pared de Santiago escrita como UTC, NO instante UTC del evento.
export function ventanaRecordatorios(ahora: number) {
  const pared = (ms:number) => {
    const p=obtenerFechaHoraInforme(ms);
    return `${p.fecha}T${p.hora}:${String(p.segundos%60).padStart(2,"0")}.${String(((ms%1000)+1000)%1000).padStart(3,"0")}Z`;
  };
  return {desde:pared(ahora+20*3600000),hasta:pared(ahora+28*3600000)};
}
function telefono(c:CitaRecordatorio) {
  // Exige prefijo internacional explícito; no adivina país ni añade 56 a datos ambiguos.
  const raw=c.client?.phone?.trim();
  if(!raw||!raw.startsWith("+"))return null;
  const canon=raw.replace(/[+\s()\-]/g,"");
  return /^[0-9]{1,32}$/.test(canon)?canon:null;
}
function candidata(c:CitaRecordatorio,tenant:string,window:{desde:string;hasta:string}) {
  return c.tenant_id===tenant&&!!c.client&&c.client.tenant_id===tenant&&["scheduled","confirmed"].includes(c.status)
    &&c.start_time>=window.desde&&c.start_time<=window.hasta;
}
// Canonizar solo la representación (Supabase puede devolver +00:00 y omitir .000).
function normalizarCita(c:CitaRecordatorio):CitaRecordatorio {
  const m=/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,6}))?(?:Z|\+00:00)?$/.exec(c.start_time);
  return m?{...c,start_time:`${m[1]}.${(m[2]??"").padEnd(3,"0").slice(0,3)}Z`}:c;
}
const same = (a:CitaRecordatorio,b:CitaRecordatorio) => a.id===b.id&&a.tenant_id===b.tenant_id&&a.status===b.status
  &&a.start_time===b.start_time&&a.date===b.date&&a.client?.id===b.client?.id&&a.client?.phone===b.client?.phone&&a.client?.email===b.client?.email;

export function crearManejadorRecordatorios(config:{
  autorizar:(req:Request)=>Promise<{ok:true}|{ok:false;status:401|503}>;
  crearDependencias:()=>DependenciasRecordatorios;
  // No habilitar en producción hasta coordinar el reclamo del cron antiguo con Claude.
  permitirEnvio?:boolean;
  configuracion?:()=>readonly string[];
}) {
  return async (req:Request) => {
    const dryRun=new URL(req.url).searchParams.get("dryRun")==="1";
    const totals={dryRun,procesados:0,candidatos:0,whatsapp:0,correos:0,omitidos:0,sin_cuota:0,ya_reclamados:0,fallidos:0,inciertos:0,intentos:0,migracion_pendiente:0,bloqueado_coordinacion:0,...(dryRun?{configuracion_faltante:[] as string[]}:{})};
    try {
      const auth=await config.autorizar(req);if(!auth.ok)return json(totals,auth.status);
      if(dryRun)totals.configuracion_faltante=[...(config.configuracion?.()??[])];
      if(!dryRun&&config.permitirEnvio!==true)return json({...totals,bloqueado_coordinacion:1},503);
      const deps=config.crearDependencias(),repo=deps.repo;
      if(!deps.sal.trim())return json(totals,503);
      const window=ventanaRecordatorios(deps.ahora());
      for(const n of await repo.negocios()) {
        if(!n.enabled||!n.tenantId||n.tenantId==="ALL"||!n.phoneNumberId)continue;
        for(const raw of await repo.citas(n.tenantId,window)) {
          // Reservar capacidad para el eventual respaldo: nunca exceder el máximo de llamadas.
          if((!dryRun&&totals.intentos>MAX_ENVIOS_RECORDATORIOS-2)||(dryRun&&totals.candidatos>=MAX_ENVIOS_RECORDATORIOS))return json(totals);
          const c=normalizarCita(raw);totals.procesados++;
          let claim:string|null=null,invocado=false;
          try {
            const para=telefono(c);
            if(!candidata(c,n.tenantId,window)||c.reminder_sent||!para){totals.omitidos++;continue;}
            const hash=hashContactoWhatsApp(deps.sal,n.tenantId,para);
            const vigente=async(email=false) => {
              const business=await repo.negocio(n.tenantId),row=await repo.actual(c);
              const current=row?normalizarCita(row):null;
              return business?.enabled===true&&business.phoneNumberId===n.phoneNumberId&&business.tenantId===n.tenantId
                &&!!current&&same(c,current)&&candidata(current,n.tenantId,ventanaRecordatorios(deps.ahora()))
                &&(email||!current.reminder_sent)&&!await repo.baja(n.tenantId,hash);
            };
            if(!await vigente()){totals.omitidos++;continue;}
            if(await repo.existe(c,"whatsapp")){totals.ya_reclamados++;continue;}
            if(!await deps.tieneCuota(n.tenantId,"whatsapp")){totals.sin_cuota++;continue;}
            if(dryRun){totals.candidatos++;continue;}
            claim=await repo.reclamar(c,"whatsapp",deps.ahora());
            if(!claim){totals.ya_reclamados++;continue;}
            if(!await vigente()){await repo.finalizar(c,"whatsapp",claim,"fallido",deps.ahora());totals.omitidos++;continue;}
            // El débito real queda DESPUÉS de ganar el reclamo; perderlo no consume cuota.
            if(!await deps.consumirCuota(n.tenantId,"whatsapp",c.id)){
              await repo.finalizar(c,"whatsapp",claim,"fallido",deps.ahora());totals.sin_cuota++;continue;
            }
            if(!await vigente()||!await repo.reservarContraCronCorreo(c,deps.ahora())){
              await repo.finalizar(c,"whatsapp",claim,"fallido",deps.ahora());totals.omitidos++;continue;
            }
            // Releer baja tras el puente, justo antes de transportar; sin interpretar texto.
            if(!await vigente(true)){await repo.finalizar(c,"whatsapp",claim,"fallido",deps.ahora());totals.omitidos++;continue;}
            totals.candidatos++;totals.intentos++;invocado=true;
            const result=await deps.enviarWhatsApp(n,c,para);
            await repo.finalizar(c,"whatsapp",claim,result.estado==="aceptado"?"aceptado_proveedor":result.estado,deps.ahora(),result.estado==="aceptado"?result.id:undefined);
            if(result.estado==="aceptado"){totals.whatsapp++;continue;}
            if(result.estado==="incierto"){totals.inciertos++;continue;}
            totals.fallidos++;
            // Solo rechazo inequívoco: nunca respaldo de incierto/exception/fallo de persistencia.
            const email=c.client?.email;
            if(!email||!/^[^\s@<>;,]+@[^\s@<>;,]+\.[^\s@<>;,]+$/.test(email)||!await vigente(true)
              ||await repo.existe(c,"email")){totals.omitidos++;continue;}
            if(!await deps.tieneCuota(n.tenantId,"email")){totals.sin_cuota++;continue;}
            const emailClaim=await repo.reclamar(c,"email",deps.ahora());
            if(!emailClaim){totals.ya_reclamados++;continue;}
            let emailInvocado=false;
            try{
              if(!await deps.consumirCuota(n.tenantId,"email",c.id)||!await vigente(true)){
                await repo.finalizar(c,"email",emailClaim,"fallido",deps.ahora());totals.omitidos++;continue;
              }
              emailInvocado=true;totals.intentos++;
              const r=await deps.enviarCorreo(c);
              await repo.finalizar(c,"email",emailClaim,r.estado==="aceptado"?"aceptado_proveedor":r.estado,deps.ahora(),r.estado==="aceptado"?r.id:undefined);
              if(r.estado==="aceptado")totals.correos++;else if(r.estado==="incierto")totals.inciertos++;else totals.fallidos++;
            }catch{
              try{await repo.finalizar(c,"email",emailClaim,emailInvocado?"incierto":"fallido",deps.ahora());}catch{}
              if(emailInvocado)totals.inciertos++;else totals.fallidos++;
            }
          }catch(e){
            if(e instanceof MigracionRecordatoriosPendiente)totals.migracion_pendiente++;
            if(claim){try{await repo.finalizar(c,"whatsapp",claim,invocado?"incierto":"fallido",deps.ahora());}catch{}}
            if(invocado)totals.inciertos++;else totals.fallidos++;
          }
        }
      }
      return json(totals);
    }catch(e){
      if(e instanceof MigracionRecordatoriosPendiente){totals.migracion_pendiente++;return json(totals);}
      return json(totals,503);
    }
  };
}

export function crearRepositorioRecordatorios(db:any):RepositorioRecordatorios {
  const table="agent_reminder_deliveries",purpose=PROPOSITO_RECORDATORIO_CITA;
  const fields="id,tenant_id,client_id,status,date,start_time,reminder_sent,client:clients!client_id(id,tenant_id,name,email,phone),barber:profiles!barber_id(name),services:appointment_services(service:services(name))";
  const ts=(ms:number)=>new Date(ms).toISOString(); // Solo instantes técnicos del registro.
  const check=(r:any)=>{if(r.error){if(["42P01","42703","PGRST204","PGRST205"].includes(r.error.code))throw new MigracionRecordatoriosPendiente();throw new Error("Recordatorios no disponibles");}return r;};
  const negocio=(r:any):NegocioRecordatorios=>({tenantId:r.tenant_id,phoneNumberId:r.phone_number_id,enabled:r.enabled===true});
  const scope=(c:CitaRecordatorio,channel:Canal)=>db.from(table).select("id").eq("tenant_id",c.tenant_id).eq("appointment_id",c.id).eq("channel",channel).eq("purpose",purpose);
  const page=async(make:(from:number)=>any)=>{const all:any[]=[];for(let from=0;;from+=1000){const r=check(await make(from));all.push(...(r.data??[]));if(!r.data||r.data.length<1000)return all;}};
  return {
    // Configuración global del job: único descubrimiento de tenants habilitados; sin input del request.
    async negocios(){return(await page(from=>db.from("agent_whatsapp_settings").select("tenant_id,phone_number_id,enabled").eq("enabled",true).order("tenant_id").range(from,from+999))).map(negocio);},
    async negocio(tenant){const r=check(await db.from("agent_whatsapp_settings").select("tenant_id,phone_number_id,enabled").eq("tenant_id",tenant).maybeSingle()).data;return r?negocio(r):null;},
    async citas(tenant,w){
      return fetchAllRows<CitaRecordatorio>(()=>{
        const q=db.from("appointments").select(fields).eq("tenant_id",tenant).in("status",["scheduled","confirmed"])
          .eq("reminder_sent",false).gte("start_time",w.desde).lte("start_time",w.hasta);
        // Conserva códigos de migración ANTES de que fetchAllRows los convierta en Error genérico.
        return {order:(column:string,options:unknown)=>({range:async(from:number,to:number)=>check(await q.order(column,options).range(from,to))})};
      });
    },
    async actual(c){return check(await db.from("appointments").select(fields).eq("tenant_id",c.tenant_id).eq("id",c.id).maybeSingle()).data;},
    async baja(tenant,hash){return !!check(await db.from("agent_contact_optouts").select("id").eq("tenant_id",tenant).eq("contact_hash",hash).maybeSingle()).data;},
    async existe(c,channel){return !!check(await scope(c,channel).maybeSingle()).data;},
    async reclamar(c,channel,ahora){return check(await db.from(table).upsert({tenant_id:c.tenant_id,appointment_id:c.id,channel,purpose,status:"procesando",attempts:1,started_at:ts(ahora)},{onConflict:"appointment_id,channel,purpose",ignoreDuplicates:true}).select("id").maybeSingle()).data?.id??null;},
    async finalizar(c,channel,id,status,ahora,provider){
      const patch={status,finished_at:ts(ahora),...(status==="aceptado_proveedor"?{provider_message_id:provider??null,provider_accepted_at:ts(ahora)}:{})};
      const r=check(await db.from(table).update(patch).eq("tenant_id",c.tenant_id).eq("appointment_id",c.id).eq("channel",channel).eq("purpose",purpose).eq("id",id).eq("status","procesando").select("id").maybeSingle());
      if(!r.data)throw new Error("Registro no actualizado");
    },
    async reservarContraCronCorreo(c,ahora){return !!check(await db.from("appointments").update({reminder_sent:true,reminder_sent_at:ts(ahora)}).eq("tenant_id",c.tenant_id).eq("id",c.id).eq("client_id",c.client!.id).eq("status",c.status).eq("start_time",c.start_time).eq("date",c.date).eq("reminder_sent",false).select("id").maybeSingle()).data;},
  };
}
