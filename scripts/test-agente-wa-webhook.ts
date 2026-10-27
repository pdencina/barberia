// Solo fixtures sintéticos y firma real sobre ellos; sin red/base/entorno.
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { inspect } from "node:util";
import { crearManejadoresWebhook, MigracionWebhookPendiente, type DependenciasWebhook } from "../src/lib/agente/whatsapp-webhook";
import { extraerMensajesEntrantes, enviarTexto } from "../src/lib/agente/whatsapp-meta";
import type { EventoUso } from "../src/lib/agente/limite-de-uso";
let cases = 0;
function check(name: string, ok: unknown) { cases++; assert.ok(ok, name); }
const secret = "firma_sintetica", salt = "sal_sintetica", phone = "10000000001", now = 1793131200000;
let serial = 0;
const payload = (m: Record<string,unknown> = {}, business = "1001") => ({ object: "whatsapp_business_account", entry: [{ changes: [{ field: "messages", value: { messaging_product: "whatsapp", metadata: {phone_number_id:business}, messages:[{id:`in.${++serial}`,from:phone,type:"text",text:{body:"confirmo"},context:{id:"out.1"},...m}] } }] }] });
const request = (p: unknown, signature = true) => {
  const body = typeof p === "string" ? p : JSON.stringify(p);
  return new Request("https://test.invalid/webhook",{method:"POST",body,headers:{"x-hub-signature-256":signature?`sha256=${createHmac("sha256",secret).update(body).digest("hex")}`:"sha256=invalid"}});
};
function fixture() {
  const events: {key:string;messageHash:string;contactHash:string;tenantId:string;atMs:number}[] = [];
  const optouts = new Set<string>(), sent: string[] = [], actions: unknown[] = [], notices: string[] = [];
  let reads = 0, enabled = true;
  const deps: DependenciasWebhook = {
    ahora:()=>now,
    repo:{
      negocio:async id=>{reads++;return id==="1001"||id==="2002"?{tenantId:id==="1001"?"tenantA":"tenantB",phoneNumberId:id,enabled}:null;},
      admitir:async e=>{
        // Simula UNA operación atómica, sin await antes del insert.
        if(events.some(x=>x.key===e.key))return {repetido:true,historial:[],consecutivos:0};
        const contact=events.filter(x=>x.tenantId===e.tenantId&&x.contactHash===e.contactHash);
        let consecutivos=0;for(const x of contact.slice().reverse()){if(x.messageHash!==e.messageHash)break;consecutivos++;}
        const historial:EventoUso[]=contact.filter(x=>x.atMs>e.ahora-3600000).map(x=>({...x}));
        events.push({...e,atMs:e.ahora});return {repetido:false,historial,consecutivos};
      }, terminar:async()=>{},
      baja:async(t,h)=>optouts.has(`${t}:${h}`),guardarBaja:async(t,h)=>{optouts.add(`${t}:${h}`);},
      referenciaAlternativa:async()=>null,
      referencia:async(t,id,h)=>id==="out.1"&&t==="tenantA"&&h===createHmac("sha256",salt).update(JSON.stringify(["agente:contacto:v1",t,phone])).digest("hex")?{registroId:"internal-delivery",clienteId:"clientA"}:null,
    },
    accion:async(t,c)=>{actions.push([t,c]);return {motivo:"ok"};},
    responder:async(_n,_p,t)=>{sent.push(t);},avisarAdministrador:async t=>{notices.push(t);},
  };
  const handlers=crearManejadoresWebhook({secretoFirma:secret,tokenVerificacion:"verify_synthetic",salHashes:salt,crearDependencias:()=>deps});
  return {deps,handlers,events,optouts,sent,actions,notices,reads:()=>reads,off:()=>{enabled=false;}};
}
async function main(){
  let f=fixture();
  check("GET challenge",await(await f.handlers.GET(new Request("https://test.invalid/?hub.mode=subscribe&hub.verify_token=verify_synthetic&hub.challenge=123"))).text()==="123");
  check("GET token ajeno",(await f.handlers.GET(new Request("https://test.invalid/?hub.mode=subscribe&hub.verify_token=otro&hub.challenge=123"))).status===403);
  check("GET no base",f.reads()===0);
  check("firma rechazada",(await f.handlers.POST(request(payload(),false))).status===401);
  check("firma antes de base",f.reads()===0);
  check("JSON inválido firmado 200",(await f.handlers.POST(request("{bad"))).status===200&&f.reads()===0);
  const missing=crearManejadoresWebhook({crearDependencias:()=>{throw Error("no debe construir");}});
  check("sin secretos no dependencias",(await missing.POST(request(payload()))).status===503);
  const p=payload();
  const concurrent=await Promise.all([f.handlers.POST(request(p)),f.handlers.POST(request(p))]);
  const counts=await Promise.all(concurrent.map(r=>r.json()));
  check("duplicados concurrentes una acción",f.actions.length===1&&counts.reduce((n,c)=>n+c.repetidos,0)===1);
  check("confirmación verificada",f.sent[0]==="Tu cita está confirmada.");
  check("contexto interno sin ids del cliente",JSON.stringify(f.actions).includes("internal-delivery")&&!JSON.stringify(f.actions).includes("out.1"));
  f=fixture();await f.handlers.POST(request(payload({},"2002")));
  check("otro tenant no usa referencia",f.actions.length===0&&f.notices[0]==="tenantB");
  f=fixture();await f.handlers.POST(request(payload({from:"10000000002"})));
  check("otro contacto no usa referencia",f.actions.length===0);
  f=fixture();f.deps.repo.referenciaAlternativa=async()=>({registroId:"internal-delivery",clienteId:"clientA"});
  await f.handlers.POST(request(payload({context:undefined})));check("sin contexto usa alternativa verificada",f.actions.length===1);
  f=fixture();f.deps.repo.referenciaAlternativa=async()=>{throw Error("no fallback de contexto explícito");};
  await f.handlers.POST(request(payload({context:{id:"forjado"}})));check("contexto explícito inválido no busca alternativa",f.notices.length===1);
  for(const context of [undefined,{id:"forjado"}]){
    f=fixture();await f.handlers.POST(request(payload({context,text:{body:"confirmo"}})));
    check("sin contexto auténtico nunca confirma",f.actions.length===0&&f.sent[0]==="Te contactará una persona.");
  }
  f=fixture();await f.handlers.POST(request(payload({context:undefined,text:{body:"confirmo out.1 internal-delivery"}})));
  check("ids dentro del texto no autorizan",f.actions.length===0);
  f=fixture();f.off();await f.handlers.POST(request(payload()));
  check("apagado sin registro/envío",f.events.length===0&&f.sent.length===0);
  f=fixture();await f.handlers.POST(request(payload({},"9999")));
  check("negocio no encontrado sin registro",f.events.length===0);
  f=fixture();await f.handlers.POST(request(payload({text:{body:"baja"}})));
  check("baja se guarda y acusa",f.optouts.size===1&&f.sent[0]==="Tu solicitud de baja quedó registrada.");
  await f.handlers.POST(request(payload()));
  check("baja bloquea siguientes",f.sent.length===1&&f.actions.length===0);
  f=fixture();for(let i=0;i<3;i++)await f.handlers.POST(request(payload()));
  check("tercer idéntico limitado",f.actions.length===2);
  f=fixture();for(let i=0;i<11;i++)await f.handlers.POST(request(payload({text:{body:i%2?"consulta A":"consulta B"}})));
  check("10 por hora aunque no consecutivos",f.sent.length===10&&f.events.length===11);
  f=fixture();for(const text of ["confirmo","cancelo","confirmo","consulta","confirmo"])await f.handlers.POST(request(payload({text:{body:text}})));
  check("repetidos no consecutivos no bloquean",f.sent.length===5);
  for(const type of ["image","audio","sticker","video","document","unsupported"]){
    f=fixture();const result=await f.handlers.POST(request(payload({type,[type]:{body:"privado",url:"https://no.invalid"}})));
    check(`medio ${type} deriva sin acción`,f.actions.length===0&&f.notices.length===1&&f.sent[0]==="Te contactará una persona.");
    check(`medio ${type} no sale`,!(await result.text()).includes("privado"));
  }
  for(const msg of [{type:"button",button:{payload:"confirmo",text:"ignorar"}},{type:"interactive",interactive:{type:"button_reply",button_reply:{id:"confirmo",title:"ignorar"}}},{type:"interactive",interactive:{type:"list_reply",list_reply:{id:"confirmo",title:"ignorar"}}}]){
    f=fixture();const p=payload(msg),e=extraerMensajesEntrantes(p,{sal:salt,resolverTenant:()=>"tenantA"})[0];
    check("extractor conserva contexto y tipo",e.persistible.context_id==="out.1"&&e.persistible.tipo===msg.type);
    if(msg.type==="interactive")check("subtipo interactivo",e.persistible.tipo_respuesta===msg.interactive!.type);
    check("contacto solo memoria explícita",e.memoria.leerRemitente()===phone&&!JSON.stringify(e).includes(phone)&&!inspect(e,{showHidden:true}).includes(phone));
    await f.handlers.POST(request(p));check("botón clasifica sin usar payload como referencia",f.actions.length===1);
  }
  for(const motivo of ["no_encontrada","estado_no_permitido","fuera_de_plazo"] as const){
    f=fixture();f.deps.accion=async()=>({motivo});await f.handlers.POST(request(payload()));
    check("rechazo nunca confirma",f.sent[0]==="Te contactará una persona.");
  }
  f=fixture();let release!:(x:{motivo:"ok"})=>void,entered!:()=>void;
  const started=new Promise<void>(r=>{entered=r;});
  f.deps.accion=()=>{entered();return new Promise(r=>{release=r;});};
  const pending=f.handlers.POST(request(payload()));await started;
  check("ninguna confirmación antes del resultado",f.sent.length===0);release({motivo:"ok"});await pending;
  check("confirmación después del resultado",f.sent.length===1);
  f=fixture();f.deps.repo.admitir=async()=>{throw new MigracionWebhookPendiente();};
  const mr=await(await f.handlers.POST(request(payload()))).json();
  check("migración faltante sin acciones/envío",mr.migracion_pendiente===1&&f.sent.length===0&&f.actions.length===0);
  f=fixture();const response=await(await f.handlers.POST(request(payload({text:{body:"texto privado RUT sintético"}})))).text();
  check("respuesta solo conteos",!response.includes(phone)&&!response.includes("privado")&&!response.includes("tenantA"));
  let fetches=0;
  const result=await enviarTexto({para:phone,texto:"Tu cita está confirmada."},{token:"synthetic",version:"v99.0",phone_number_id:"1001",fetch:async(_u,o)=>{fetches++;const b=JSON.parse(String(o.body));check("envío texto transporta contrato",b.type==="text"&&b.to===phone);return {status:200,json:async()=>({messages:[{id:"out.1"}]})};}});
  check("una petición sin reintento",result.estado==="aceptado"&&fetches===1);
  console.log(`OK: ${cases} casos webhook; sin red/base/entorno ni mensajes reales.`);
}
main().catch(e=>{console.error(e instanceof assert.AssertionError?e.message:"FALLO de prueba, detalle privado omitido");process.exitCode=1;});
