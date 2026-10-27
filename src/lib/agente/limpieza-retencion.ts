import { fetchAllRows } from "../accounting";
export type TablaRetencion = "agent_whatsapp_events" | "agent_reminder_deliveries";
const columnas:Record<TablaRetencion,string>={agent_whatsapp_events:"received_at",agent_reminder_deliveries:"created_at"};
export interface NegocioRetencion {tenant_id:string;retention_days:number|null}
export interface RepositorioRetencion {
 negocios:()=>Promise<NegocioRetencion[]>;
 antiguos:(tenant:string,tabla:TablaRetencion,corte:string)=>Promise<{id:string|number}[]>;
 borrar:(tenant:string,tabla:TablaRetencion,corte:string,ids:(string|number)[])=>Promise<number>;
}
export class MigracionRetencionPendiente extends Error {constructor(){super("Falta aplicar la migración de retención 005/006");}}
export function corteRetencion(ahora:number,dias=30){
 if(!Number.isFinite(ahora)||!Number.isInteger(dias)||dias<15||dias>30)throw new Error("Retención inválida");
 return new Date(ahora-dias*86400000).toISOString(); // Instante técnico, no fecha de cita.
}
export function crearManejadorLimpieza(config:{
 autorizar:(req:Request)=>Promise<{ok:true}|{ok:false;status:401|503}>;
 crearDependencias:()=>{repo:RepositorioRetencion;ahora:()=>number};permitirBorrado?:boolean;
 // Extensión opcional C8; mantiene PRs independientes desde agente/whatsapp.
 configuracion?:()=>readonly string[]|undefined;
}){
 return async(req:Request)=>{
  const dryRun=new URL(req.url).searchParams.get("dryRun")==="1";
  const totals={dryRun,negocios:0,eventos_candidatos:0,envios_candidatos:0,eventos_borrados:0,envios_borrados:0,fallidos:0,migracion_pendiente:0,borrado_bloqueado:0};
  let extra:{}|{configuracion_faltante:readonly string[]}={};
  const reply=(status=200)=>new Response(JSON.stringify({...totals,...extra}),{status,headers:{"Content-Type":"application/json","Cache-Control":"no-store"}});
  try{
   const auth=await config.autorizar(req);if(!auth.ok)return reply(auth.status);
   if(dryRun){const missing=config.configuracion?.();if(missing)extra={configuracion_faltante:missing};}
   if(!dryRun&&config.permitirBorrado!==true){totals.borrado_bloqueado=1;return reply(503);}
   const {repo,ahora}=config.crearDependencias(),now=ahora();
   for(const n of await repo.negocios()){
    if(!n.tenant_id||n.tenant_id==="ALL"){totals.fallidos++;continue;}
    try{
     const corte=corteRetencion(now,n.retention_days??30);totals.negocios++;
     for(const tabla of Object.keys(columnas) as TablaRetencion[]){
      const rows=await repo.antiguos(n.tenant_id,tabla,corte);
      if(tabla==="agent_whatsapp_events")totals.eventos_candidatos+=rows.length;else totals.envios_candidatos+=rows.length;
      if(dryRun)continue;
      // Primero lee todas las páginas, luego borra lotes pequeños sin saltar por offsets.
      for(let i=0;i<rows.length;i+=100){const deleted=await repo.borrar(n.tenant_id,tabla,corte,rows.slice(i,i+100).map(r=>r.id));
       if(tabla==="agent_whatsapp_events")totals.eventos_borrados+=deleted;else totals.envios_borrados+=deleted;
      }
     }
    }catch(e){totals.fallidos++;if(e instanceof MigracionRetencionPendiente)totals.migracion_pendiente++;}
   }
   return reply();
  }catch(e){if(e instanceof MigracionRetencionPendiente){totals.migracion_pendiente++;return reply();}totals.fallidos++;return reply(503);}
 };
}
export function crearRepositorioRetencion(db:any):RepositorioRetencion{
 const check=(r:any)=>{if(r.error){if(["42P01","42703","PGRST204","PGRST205"].includes(r.error.code))throw new MigracionRetencionPendiente();throw new Error("Retención no disponible");}return r;};
 const columna=(tabla:TablaRetencion)=>{if(!Object.prototype.hasOwnProperty.call(columnas,tabla))throw new Error("Tabla no autorizada");return columnas[tabla];};
 return {
  async negocios(){const all:NegocioRetencion[]=[];for(let from=0;;from+=1000){const r=check(await db.from("agent_whatsapp_settings").select("tenant_id,retention_days").order("tenant_id").range(from,from+999));all.push(...(r.data??[]));if(!r.data||r.data.length<1000)return all;}},
  async antiguos(tenant,tabla,corte){const col=columna(tabla);return fetchAllRows(()=>({order:(name:string,options:unknown)=>({range:async(from:number,to:number)=>check(await db.from(tabla).select("id").eq("tenant_id",tenant).lt(col,corte).order(name,options).range(from,to))})}));},
  async borrar(tenant,tabla,corte,ids){const col=columna(tabla);if(!ids.length)return 0;if(ids.length>100)throw new Error("Lote demasiado grande");return(check(await db.from(tabla).delete().eq("tenant_id",tenant).lt(col,corte).in("id",ids).select("id")).data??[]).length;},
 };
}
