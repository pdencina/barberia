// Repositorio real sobre base simulada; HEAD cuenta sin devolver datos de otros clientes.
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { crearRepositorioWebhook, MigracionWebhookPendiente } from "../src/lib/agente/whatsapp-webhook";
import { hashContactoWhatsApp, normalizarTelefonoWhatsApp } from "../src/lib/agente/whatsapp-meta";
import { patronTelefonoCanonico, type Cliente, type Registro } from "../src/lib/agente/referencia-alternativa";
let n=0;
const check=(label:string,ok:unknown)=>{n++;assert.ok(ok,label);};
const now=Date.UTC(2026,9,27,18),salt="synthetic",tenant="A";
const cid=(i:number)=>`c${String(i).padStart(4,"0")}`;
const phone=(i:number)=>`+56${900000000+i}`;
const record=(i:number):Registro=>({id:`d${String(i).padStart(5,"0")}`,tenant_id:tenant,appointment_id:`appt${i}`,channel:"whatsapp",purpose:"recordatorio-cita-v1",status:"aceptado_proveedor",provider_accepted_at:"2026-10-27T17:00:00Z",provider_message_id:`provider${i}`,appointment:{id:`appt${i}`,tenant_id:tenant,client_id:cid(i),start_time:"2026-10-28T15:00:00Z"}});
interface Query{table:string;fields?:string;options?:{count?:string;head?:boolean};calls:[string,any[]][]}
function fixture(records:Registro[]=[record(1),record(2)]){
 const clients:Cliente[]=Array.from({length:3000},(_,i)=>({id:cid(i),tenant_id:tenant,phone:phone(i)}));
 const queries:Query[]=[],downloaded:string[]=[];
 const flags={missingCount:false,failClients:false,spoof:false};
 const field=(r:any,key:string)=>key.split(".").reduce((v,k)=>v?.[k],r);
 const db={from(table:string){const q:Query={table,calls:[]};queries.push(q);const chain:any=new Proxy({}, {get(_t,k){
  if(k==="then")return (resolve:any,reject:any)=>{try{
   if(q.table==="clients"&&flags.failClients)return resolve({data:null,error:{code:"42P01",message:"privado"}});
   let data:any[]=q.table==="clients"?clients.slice():records.slice();
   for(const [method,args]of q.calls){const [col,value]=args;
    if(method==="eq")data=data.filter(r=>field(r,col)===value);
    if(method==="neq")data=data.filter(r=>field(r,col)!==value);
    if(method==="gte")data=data.filter(r=>Date.parse(field(r,col))>=Date.parse(value));
    if(method==="lte")data=data.filter(r=>Date.parse(field(r,col))<=Date.parse(value));
    if(method==="in")data=data.filter(r=>value.includes(field(r,col)));
    if(method==="filter"){
     assert.equal(col,"phone");assert.equal(value,"match");const quoted=args[2] as string;
     assert.ok(quoted.startsWith('"')&&quoted.endsWith('"'));
     const pattern=quoted.slice(1,-1).replace(/\\([\\"])/g,"$1"),regex=new RegExp(pattern);
     data=data.filter(r=>typeof r.phone==="string"&&regex.test(r.phone));
    }
   }
   if(q.options?.head){return resolve({data:null,error:null,count:flags.missingCount?null:data.length});}
   data.sort((a,b)=>String(a.id).localeCompare(String(b.id)));
   const range=q.calls.find(([m])=>m==="range")?.[1];if(range)data=data.slice(range[0],range[1]+1);
   if(q.table==="clients"){
    if(flags.spoof)data.push({id:"outsider",tenant_id:"B",phone:phone(1)});
    downloaded.push(...data.map(r=>r.id));
   }
   resolve({data,error:null});
  }catch(e){reject(e);}};
  return(...args:any[])=>{if(k==="select"){q.fields=args[0];q.options=args[1];}else q.calls.push([String(k),args]);return chain;};
 }});return chain;}};
 const run=(hash=hashContactoWhatsApp(salt,tenant,normalizarTelefonoWhatsApp(phone(1))!))=>crearRepositorioWebhook(db,salt).referenciaAlternativa(tenant,hash,now);
 return {clients,records,queries,downloaded,flags,run};
}
async function main(){
 let f=fixture();assert.deepEqual(await f.run(),{registroId:"d00001",clienteId:"c0001"});n++;
 check("3000 clientes: solo se descargan los dos candidatos",f.clients.length===3000&&f.downloaded.length===2&&f.downloaded.every(id=>[cid(1),cid(2)].includes(id)));
 check("consulta primero recordatorios",f.queries[0].table==="agent_reminder_deliveries");
 check("lecturas de clientes siempre por lote candidato y tenant",f.queries.filter(q=>q.table==="clients"&&!q.options?.head).every(q=>q.calls.some(([m,a])=>m==="in"&&a[0]==="id"&&a[1].every((id:string)=>[cid(1),cid(2)].includes(id)))&&q.calls.some(([m,a])=>m==="eq"&&a[0]==="tenant_id"&&a[1]===tenant)));
 check("ambigüedad global solo HEAD/conteo",f.queries.some(q=>q.table==="clients"&&q.options?.head===true&&q.options.count==="exact"&&q.fields==="id"));
 for(const raw of ["+56900000001","56900000001","900000001","0900000001","09 0000-0001","+56 (9) 0000-0001","0+56900000001"]){
  f=fixture();f.clients[2999].phone=raw;assert.equal(await f.run(),null);n++;
  check("cliente duplicado sin cita no se descarga",f.downloaded.length===2&&!f.downloaded.includes(cid(2999)));
 }
 f=fixture();f.clients.push({id:"foreignTenant",tenant_id:"B",phone:phone(1)});check("otro negocio no causa ambigüedad",(await f.run())?.clienteId===cid(1));
 f=fixture([]);assert.equal(await f.run(),null);n++;check("sin recordatorios no consulta clientes",f.queries.every(q=>q.table!=="clients"));
 for(const bad of [ {...record(1),appointment:{...record(1).appointment,start_time:"2026-10-27T14:59:59Z"}}, {...record(1),tenant_id:"B"}, {...record(1),channel:"email"}, {...record(1),status:"incierto"}, {...record(1),provider_accepted_at:"2026-10-25T17:59:59.999Z"}]){
  f=fixture([bad]);assert.equal(await f.run(),null);n++;check("descarta antes de descargar clientes",f.downloaded.length===0);
 }
 f=fixture([record(1),{...record(1),id:"second",provider_message_id:"second-provider"}]);assert.equal(await f.run(),null);n++;
 f=fixture();f.flags.missingCount=true;await assert.rejects(()=>f.run(),/Conteo de identidad no disponible/);n++;
 f=fixture();f.flags.failClients=true;await assert.rejects(()=>f.run(),MigracionWebhookPendiente);n++;
 f=fixture();f.flags.spoof=true;assert.equal(await f.run(),null);n++;
 f=fixture(Array.from({length:1001},(_,i)=>record(i)));assert.deepEqual(await f.run(),{registroId:"d00001",clienteId:"c0001"});n++;
 check("pagina 1001 recordatorios",f.queries.filter(q=>q.table==="agent_reminder_deliveries").length===2);
 const reads=f.queries.filter(q=>q.table==="clients"&&!q.options?.head);
 check("divide IDs en 11 lotes de hasta100",reads.length===11&&reads.every(q=>q.calls.find(([m])=>m==="in")![1][1].length<=100));
 check("descarga1001 candidatos, no3000",f.downloaded.length===1001);
 // Paridad con el normalizador real: variantes con cero, países y todos los espacios JS.
 const samples=["+56912345678","56912345678","912345678","0912345678","0+56912345678","0056912345678","+12025550101","0+12025550101","+56","056","+56561234567","00561234567","+560912345678","00912345678","bad56912345678","++56912345678","",null];
 const separators=[""," ","-","()","\t","\n","\v","\f","\r","\u00a0","\u1680","\u2000","\u2001","\u2002","\u2003","\u2004","\u2005","\u2006","\u2007","\u2008","\u2009","\u200a","\u2028","\u2029","\u202f","\u205f","\u3000","\ufeff"];
 for(const canon of ["56912345678","12025550101","56","56561234567","560912345678","560056912345678"]){
  const pattern=patronTelefonoCanonico(canon),regex=new RegExp(pattern);
  for(const sample of samples)for(const sep of separators){const raw=typeof sample==="string"?sep+sample.split("").join(sep)+sep:sample;assert.equal(typeof raw==="string"&&regex.test(raw),normalizarTelefonoWhatsApp(raw)===canon);n++;}
 }
 assert.throws(()=>patronTelefonoCanonico(".*"));n++;
 // SDK real con fetch simulado: HEAD, sin respuestas de clientes ajenos ni red.
 let transport=0;
 const supabase=createClient("https://synthetic.invalid","synthetic",{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:async(input,options)=>{
  transport++;const url=new URL(String(input));check("SDK usa HEAD",options?.method==="HEAD");check("SDK conserva tenant",url.searchParams.get("tenant_id")==="eq.A");
  check("SDK excluye cliente elegido",url.searchParams.get("id")==="neq.c0001");check("URL no supera8192",url.toString().length<8192);
  return new Response(null,{status:200,headers:{"content-range":"*/0"}});
 }}});
 const maxPattern=patronTelefonoCanonico("569"+"1".repeat(29));
 const quoted='"'+maxPattern.replace(/\\/g,"\\\\").replace(/"/g,'\\"')+'"';
 const result=await supabase.from("clients").select("id",{count:"exact",head:true}).eq("tenant_id",tenant).neq("id",cid(1)).filter("phone","match",quoted);
 check("SDK recibe solo conteo cero",result.count===0&&result.data===null&&transport===1);
 console.log(`OK ${n} comprobaciones rendimiento/identidad; 3000 clientes simulados, sin red/base real. Regex PostgreSQL y plan real no ejecutados.`);
}
main().catch(e=>{console.error(e instanceof assert.AssertionError?e.message:"FALLO rendimiento, datos omitidos");process.exitCode=1;});
