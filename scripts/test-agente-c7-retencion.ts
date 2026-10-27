import assert from "node:assert/strict";
import { corteRetencion, crearManejadorLimpieza, crearRepositorioRetencion, type TablaRetencion } from "../src/lib/agente/limpieza-retencion";
let n=0;const check=(name:string,ok:unknown)=>{n++;assert.ok(ok,name);};
const now=Date.UTC(2026,9,27,18),day=86400000;
async function main(){
 check("default30",corteRetencion(now)===new Date(now-30*day).toISOString());
 for(const days of [14,31]){assert.throws(()=>corteRetencion(now,days));n++;}
 const rows=Array.from({length:1002},(_,id)=>({id,tenant:"A",at:now-16*day,table:"agent_whatsapp_events"}));
 rows.push({id:2000,tenant:"A",at:now-15*day,table:"agent_whatsapp_events"},{id:2001,tenant:"B",at:now-20*day,table:"agent_whatsapp_events"},{id:2002,tenant:"B",at:now-31*day,table:"agent_reminder_deliveries"},{id:2003,tenant:"other",at:now-100*day,table:"agent_reminder_deliveries"},{id:2004,tenant:"A",at:now-100*day,table:"agent_contact_optouts"});
 let deletes=0,built=0;
 const repo={negocios:async()=>[{tenant_id:"A",retention_days:15},{tenant_id:"B",retention_days:30}],antiguos:async(t:string,table:TablaRetencion,cut:string)=>rows.filter(r=>r.tenant===t&&r.table===table&&r.at<Date.parse(cut)).map(r=>({id:r.id})),borrar:async(t:string,table:TablaRetencion,cut:string,ids:(string|number)[])=>{deletes++;let count=0;for(let i=rows.length-1;i>=0;i--){const r=rows[i];if(r.tenant===t&&r.table===table&&r.at<Date.parse(cut)&&ids.includes(r.id)){rows.splice(i,1);count++;}}return count;}};
 const handler=(allow=false,auth:()=>Promise<{ok:true}|{ok:false;status:401|503}>=async()=>({ok:true}))=>crearManejadorLimpieza({autorizar:auth,permitirBorrado:allow,crearDependencias:()=>{built++;return {repo,ahora:()=>now};}});
 const req=(dry=false)=>new Request(`https://test.invalid/retention${dry?"?dryRun=1":""}`);
 let r=await(await handler()(req(true))).json();check("dryrun cuenta1002 +1",r.eventos_candidatos===1002&&r.envios_candidatos===1);check("dryrun cero borrados",deletes===0&&rows.length===1007);
 const before=built;r=await(await handler()(req())).json();check("real bloqueado antes de base",r.borrado_bloqueado===1&&built===before);
 r=await(await handler(true)(req())).json();check("borrado solo simulado por negocio",r.eventos_borrados===1002&&r.envios_borrados===1);
 check("borde exacto intacto",rows.some(r=>r.id===2000));check("B conserva20d",rows.some(r=>r.id===2001));check("otro tenant intacto",rows.some(r=>r.id===2003));check("bajas intactas",rows.some(r=>r.id===2004));
 check("lotes acotados",deletes===12);
 const guard=await handler(true,async()=>({ok:false,status:401}))(req(true));check("auth protege dryRun",guard.status===401);
 const queries:any[]=[];
 const db={from(table:string){const calls:any[]=[];queries.push({table,calls});const q:any=new Proxy({}, {get(_t,k){if(k==="then")return(resolve:any)=>{const from=calls.find(c=>c[0]==="range")?.[1][0];resolve({data:Array.from({length:from===0?1000:2},(_,id)=>({id})),error:null});};return(...args:any[])=>{calls.push([k,args]);return q;};}});return q;}};
 const adapter=crearRepositorioRetencion(db);const all=await adapter.antiguos("A","agent_whatsapp_events",corteRetencion(now,15));check("adapter pagina sobre1000",all.length===1002&&queries.length===2);
 check("cada página filtra tenant y corte estricto",queries.every(q=>q.calls.some((c:any)=>c[0]==="eq"&&c[1][0]==="tenant_id"&&c[1][1]==="A")&&q.calls.some((c:any)=>c[0]==="lt"&&c[1][0]==="received_at")));
 await assert.rejects(()=>adapter.borrar("A","agent_contact_optouts" as TablaRetencion,corteRetencion(now),[1]));n++;
 console.log(`OK ${n} casos C7; borrado exclusivamente en memoria, sin base real.`);
}main().catch(e=>{console.error(e instanceof assert.AssertionError?e.message:"FALLO C7");process.exitCode=1;});
