import { fetchAllRows } from "../accounting";
import { tenantBookingUrl } from "../retention";
import type { DatosFaq } from "./faq-fija";
export interface DatosNegocio extends DatosFaq {}
class EsquemaAusente extends Error {}
const revisar=(r:any)=>{
 if(r?.error){if(["42P01","42703","PGRST204","PGRST205"].includes(r.error.code))throw new EsquemaAusente();throw new Error("Lectura comercial no disponible");}
 return r;
};
const texto=(v:unknown)=>typeof v==="string"&&v.trim()?v.trim():null;
const numero=(v:unknown)=>typeof v==="number"&&Number.isFinite(v)&&v>=0?v:null;
const hora=(v:unknown)=>typeof v==="string"&&/^([01]\d|2[0-3]):[0-5]\d(?::00(?:\.0+)?)?$/.test(v)?v.slice(0,5):null;

// HECHO: tenants.id es la identidad padre (no tiene tenant_id):
// src/app/api/public/tenant-booking/route.ts:13-18. Todas las tablas hijas filtran tenant_id.
// Direcciones y horarios separados por sucursal; nunca se elige una por defecto.
export function crearRepositorioDatosNegocio(db:any,dependencias:{enlace?:typeof tenantBookingUrl}={}){
 const enlace=dependencias.enlace??tenantBookingUrl;
 async function negocio(tenant:string){
  const leer=async(columns:string)=>revisar(await db.from("tenants").select(columns).eq("id",tenant).eq("active",true).maybeSingle()).data;
  try{return await leer("id,name,address,phone,slug,active,status");}
  catch(e){if(!(e instanceof EsquemaAusente))throw e;try{return await leer("*");}catch(next){if(next instanceof EsquemaAusente)return null;throw next;}}
 }
 async function filas(table:"business_hours"|"services"|"branches",tenant:string,columns:string):Promise<any[]>{
  const leer=(selection:string)=>fetchAllRows(()=>{
   let q=db.from(table).select(selection).eq("tenant_id",tenant);
   if(table==="services"||table==="branches")q=q.eq("active",true);
   return {order:(col:string,opt:unknown)=>({range:async(from:number,to:number)=>revisar(await q.order(col,opt).range(from,to))})};
  });
  // Patrón whitelist de src/app/api/public/business-info/route.ts:5-24: si falta una columna opcional, leer lo existente
  // y proyectar SOLO campos comerciales. Nunca retirar filtros tenant/active al reintentar.
  try{return await leer(columns);}
  catch(e){if(!(e instanceof EsquemaAusente))throw e;try{return await leer("*");}catch(next){if(next instanceof EsquemaAusente){if(table==="branches")throw next;return [];}throw next;}}
 }
 return {
  async datosDelNegocio(tenantId:string):Promise<DatosNegocio|null>{
   if(typeof tenantId!=="string"||!tenantId.trim()||tenantId!==tenantId.trim()||tenantId==="ALL")return null;
   try{
    const t=await negocio(tenantId);
    if(!t||t.id!==tenantId||t.active!==true||t.status==="suspended")return null;
    // HECHO: business_hours campos en src/app/api/public/business-info/route.ts:50-55;
    // services activos/precio/duración en src/app/api/public/services/route.ts:24-32.
    const hours=await filas("business_hours",tenantId,"id,tenant_id,branch_id,day_of_week,open_time,close_time,is_closed");
    const services=await filas("services",tenantId,"id,tenant_id,name,price,duration,active");
    if(hours.some(r=>r.tenant_id!==tenantId)||services.some(r=>r.tenant_id!==tenantId))return null;
    let branches:any[]|null=null;
    // Fuente: src/app/api/branches/route.ts:15-21, 31-32, 47-56 (nombre/dirección, tenant, activo).
    try{branches=await filas("branches",tenantId,"id,tenant_id,name,address,active");}catch(e){if(!(e instanceof EsquemaAusente))throw e;}
    if(branches?.some(b=>b.tenant_id!==tenantId||!texto(b.id)))return null;
    const adaptarHorario=(branchId:string|null):DatosNegocio["horario"]=>{
     const horario:DatosNegocio["horario"]=[],dias=new Set<number>();
     for(const h of hours){
      if((h.branch_id??null)!==branchId)continue;
      if(!Number.isInteger(h.day_of_week)||h.day_of_week<0||h.day_of_week>6||typeof h.is_closed!=="boolean")return [];
      if(dias.has(h.day_of_week))return [];dias.add(h.day_of_week);
      horario.push({dia:h.day_of_week,cerrado:h.is_closed,abre:h.is_closed?null:hora(h.open_time),cierra:h.is_closed?null:hora(h.close_time)});
     }
     return horario.sort((a,b)=>a.dia-b.dia);
    };
    const sucursales=branches===null?null:branches.filter(b=>b.active===true).map(b=>({id:b.id,nombre:texto(b.name),direccion:texto(b.address),horario:adaptarHorario(b.id)}));
    // Sin semana por branch_id no se extrapolan open_time/close_time a días desconocidos.
    const horario=adaptarHorario(null);
    const active=services.filter(s=>s.active===true);
    // Sin nombre no se puede demostrar coincidencia única: no publicar catálogo parcial de precios.
    const catalogo:DatosNegocio["servicios"]=active.some(s=>!texto(s.name))?[]:active.map(s=>({nombre:texto(s.name)!,precio:numero(s.price),duracionMin:Number.isInteger(s.duration)?numero(s.duration):null}));
    let linkReserva:string|null=null;
    const slug=texto(t.slug);
    if(slug&&!/[\s/\\?#\u0000-\u001f\u007f]/.test(slug)){
     // tenant-booking RESUELVE slug, no crea URL. Reutiliza fuente real src/lib/retention.ts:214-220.
     // No aceptar su fallback genérico /booking ni otro negocio ante error/cambio concurrente.
     const candidate=await enlace(db,tenantId),url=new URL(candidate);
     if(!["https:","http:"].includes(url.protocol)||url.username||url.password||url.search||url.hash||!decodeURIComponent(url.pathname).endsWith(`/b/${slug}`))return null;
     linkReserva=candidate;
    }
    return {negocio:{nombre:texto(t.name),direccion:texto(t.address),telefono:texto(t.phone),linkReserva},horario,servicios:catalogo,sucursales};
   }catch{return null;} // Error operativo no se disfraza de dato conocido ni se serializa en logs.
  },
 };
}
