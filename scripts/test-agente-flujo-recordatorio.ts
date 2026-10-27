// Lógica REAL, puertos de base/proveedor simulados. Ningún acceso a red, entorno o llaves.
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { crearManejadorRecordatorios, type CitaRecordatorio } from "../src/lib/agente/recordatorios-whatsapp";
import { crearManejadoresWebhook } from "../src/lib/agente/whatsapp-webhook";
import { confirmarCitaPropia, cancelarCitaPropia } from "../src/lib/agente/acciones-cita";
import { enviarPlantilla, enviarTexto, hashContactoWhatsApp } from "../src/lib/agente/whatsapp-meta";
let n=0;const check=(name:string,ok:unknown)=>{n++;assert.ok(ok,name);};
const sal="sal_sintetica",secret="firma_sintetica",phone="56900000001";
function fixture(two=false){
 let clock=Date.UTC(2026,9,27,12),transitions=0,notifications=0,serial=0;
 const rows:CitaRecordatorio[]=(two?["A","B"]:["A"]).map(t=>({id:`appt${t}`,tenant_id:t,status:"scheduled",start_time:"2026-10-28T09:00:00.000Z",date:"2026-10-28",reminder_sent:false,client:{id:`client${t}`,tenant_id:t,name:"Sintetico",phone:`+${phone}`,email:null},barber:{name:"Profesional"},services:[{service:{name:"Servicio"}}]}));
 const deliveries=new Map<string,any>(),events=new Set<string>(),optouts=new Set<string>(),acks:string[]=[],templates:any[]=[];
 const negocio=(t:string)=>({tenantId:t,phoneNumberId:t==="A"?"1001":"2002",enabled:true});
 const key=(c:CitaRecordatorio,ch:string)=>`${c.tenant_id}:${c.id}:${ch}`;
 const mark=async(c:CitaRecordatorio)=>{const row=rows.find(x=>x.id===c.id)!;row.reminder_sent=true;return true;};
 const reminderRepo={negocios:async()=>rows.map(r=>negocio(r.tenant_id)),negocio:async(t:string)=>negocio(t),
  citas:async(t:string)=>rows.filter(r=>r.tenant_id===t&&!r.reminder_sent).map(r=>({...r})),actual:async(c:CitaRecordatorio)=>rows.find(r=>r.id===c.id&&r.tenant_id===c.tenant_id)??null,
  baja:async(t:string,h:string)=>optouts.has(`${t}:${h}`),existe:async(c:CitaRecordatorio,ch:string)=>deliveries.has(key(c,ch)),
  reclamar:async(c:CitaRecordatorio,ch:string)=>{const k=key(c,ch);if(deliveries.has(k))return null;deliveries.set(k,{id:k,cita:c.id,tenant:c.tenant_id,status:"procesando",channel:ch});return k;},
  finalizar:async(c:CitaRecordatorio,ch:string,id:string,status:string,_now:number,provider?:string)=>{const r=deliveries.get(key(c,ch));assert.equal(r.id,id);r.status=status;r.provider=provider;},
  reservarContraCronCorreo:mark,marcarRecordatorio:mark,
 };
 const send=crearManejadorRecordatorios({permitirEnvio:true,autorizar:async()=>({ok:true}),crearDependencias:()=>({repo:reminderRepo,sal,ahora:()=>clock,tieneCuota:async()=>true,consumirCuota:async()=>true,
  enviarWhatsApp:async(b,c,para)=>enviarPlantilla({para,plantilla:"synthetic",idioma:"es_CL",variables:[]},{token:"synthetic",version:"v99.0",phone_number_id:b.phoneNumberId,fetch:async(_u,o)=>{templates.push(JSON.parse(String(o.body)));return {status:200,json:async()=>({messages:[{id:`out.${c.id}`}]})};}}),enviarCorreo:async()=>{throw Error("no fallback esperado");}})});
 const actionRepo={desdeRecordatorio:async(ctx:any)=>{const d=deliveries.get(ctx.referenciaRecordatorio);if(!d||d.tenant!==ctx.tenantId||d.status!=="aceptado_proveedor"||d.channel!=="whatsapp")return null;const row=rows.find(r=>r.id===d.cita&&r.tenant_id===ctx.tenantId&&r.client?.id===ctx.clienteId);return row?{...row,client_id:row.client!.id,barber_id:null,client:{name:"Sintetico"}}:null;},transicionar:async(c:any,status:"confirmed"|"cancelled")=>{const r=rows.find(r=>r.id===c.id&&r.tenant_id===c.tenant_id);if(!r||r.status!==c.status||r.start_time!==c.start_time)return false;r.status=status;transitions++;return true;}};
 const webhookRepo:any={negocio:async(id:string)=>id==="1001"?negocio("A"):id==="2002"&&two?negocio("B"):null,
  admitir:async(e:any)=>{if(events.has(e.key))return {repetido:true,historial:[],consecutivos:0};events.add(e.key);return {repetido:false,historial:[],consecutivos:0};},terminar:async()=>{},baja:reminderRepo.baja,
  guardarBaja:async(t:string,h:string)=>{optouts.add(`${t}:${h}`);},reclamarAviso:async()=>true,referenciaAlternativa:async()=>null,
  referencia:async(t:string,id:string,h:string)=>{const d=Array.from(deliveries.values()).find(r=>r.tenant===t&&r.provider===id&&r.status==="aceptado_proveedor");const c=rows.find(r=>r.id===d?.cita&&r.tenant_id===t);return c&&h===hashContactoWhatsApp(sal,t,phone)?{registroId:d.id,clienteId:c.client!.id}:null;},
 };
 const hook=crearManejadoresWebhook({secretoFirma:secret,salHashes:sal,crearDependencias:()=>({repo:webhookRepo,ahora:()=>clock,
  accion:(type,c)=>(type==="confirmar"?confirmarCitaPropia:cancelarCitaPropia)(c,{repo:actionRepo,ahora:()=>clock,notificar:async()=>{notifications++;}}),
  responder:async(b,para,texto)=>enviarTexto({para,texto},{token:"synthetic",version:"v99.0",phone_number_id:b.phoneNumberId,fetch:async(_u,o)=>{const m=JSON.parse(String(o.body));const row=rows.find(r=>r.tenant_id===b.tenantId)!;if(m.text.body==="Tu cita está confirmada.")check("acuse después de confirmar",row.status==="confirmed");if(m.text.body==="Tu cita está cancelada.")check("acuse después de cancelar",row.status==="cancelled");acks.push(m.text.body);return {status:200,json:async()=>({messages:[{id:`ack.${acks.length}`}]})};}}),avisarAdministrador:async()=>{notifications++;},})});
 const inbound=(text:string,t="A",id=`in.${++serial}`,button=false)=>({object:"whatsapp_business_account",entry:[{changes:[{field:"messages",value:{messaging_product:"whatsapp",metadata:{phone_number_id:t==="A"?"1001":"2002"},messages:[{id,from:phone,type:button?"button":"text",...(button?{button:{payload:text,text}}:{text:{body:text}}),context:{id:`out.appt${t}`}}]}}]}]});
 const receive=async(p:unknown)=>{const body=JSON.stringify(p);return hook.POST(new Request("https://test.invalid/webhook",{method:"POST",body,headers:{"x-hub-signature-256":`sha256=${createHmac("sha256",secret).update(body).digest("hex")}`}}));};
 return {rows,deliveries,templates,acks,optouts,inbound,receive,send:()=>send(new Request("https://test.invalid/reminders")),count:()=>({transitions,notifications}),clock:(ms:number)=>{clock=ms;}};
}
async function main(){
 for(const [button,state]of [["Confirmar","confirmed"],["Cancelar","cancelled"]]){const f=fixture();await f.send();check("plantilla real con fetch simulado",f.templates.length===1&&f.templates[0].type==="template");const p=f.inbound(button,"A","duplicate",true);await f.receive(p);check("transición correcta",f.rows[0].status===state);check("acuse emitido",f.acks.length===1);await f.receive(p);check("evento repetido no vuelve a actuar/enviar",f.count().transitions===1&&f.acks.length===1);}
 let f=fixture();await f.send();f.clock(Date.UTC(2026,9,28,11));await f.receive(f.inbound("Cancelar","A",undefined,true));check("corte 2h impide cancelar a 1h",f.rows[0].status==="scheduled"&&!f.acks.includes("Tu cita está cancelada."));
 f=fixture();await f.send();f.clock(Date.UTC(2026,9,28,10));await f.receive(f.inbound("Cancelar","A",undefined,true));check("exactamente 2h permite cancelar",f.rows[0].status==="cancelled");
 f=fixture();await f.send();await f.receive(f.inbound("baja"));check("baja registrada",f.optouts.size===1);await f.receive(f.inbound("Confirmar","A",undefined,true));check("baja bloquea confirmación y nuevo contacto",f.rows[0].status==="scheduled"&&f.acks.length===1);
 f=fixture();await f.send();await f.receive(f.inbound("quizás sí"));check("ambiguo deriva sin modificar",f.rows[0].status==="scheduled"&&f.acks[0]==="Te contactará una persona."&&f.count().notifications===1);
 f=fixture(true);await f.send();check("dos negocios envían aislados",f.templates.length===2);await f.receive(f.inbound("baja","A"));await f.receive(f.inbound("Confirmar","B",undefined,true));check("baja A no afecta B",f.rows[0].status==="scheduled"&&f.rows[1].status==="confirmed");
 f=fixture();await f.send();f.optouts.add(`A:${hashContactoWhatsApp(sal,"A",phone)}`);await f.receive(f.inbound("Confirmar","A",undefined,true));check("baja entre envío/respuesta bloquea toda salida",f.acks.length===0&&f.rows[0].status==="scheduled");
 console.log(`OK ${n} comprobaciones de flujo real con puertos simulados; sin red/base/llaves.`);
}main().catch(e=>{console.error(e instanceof assert.AssertionError?e.message:"FALLO flujo simulado");process.exitCode=1;});
