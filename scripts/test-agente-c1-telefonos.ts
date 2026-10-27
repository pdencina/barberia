import assert from "node:assert/strict";
import { normalizarTelefonoWhatsApp, hashContactoWhatsApp } from "../src/lib/agente/whatsapp-meta";
import { crearRepositorioWebhook } from "../src/lib/agente/whatsapp-webhook";
let n=0;
async function main(){
for(const [input,expected] of [["+56912345678","56912345678"],["56912345678","56912345678"],["912345678","56912345678"],["0912345678","56912345678"],[" 09 1234-5678 ","56912345678"],["+1 (202) 555-0101","12025550101"]]){
 assert.equal(normalizarTelefonoWhatsApp(input),expected);n++;
 const db={from(table:string){const row=table==="agent_reminder_deliveries"?{id:"delivery",appointment_id:"appt"}:{client_id:"client",client:{id:"client",tenant_id:"tenant",phone:input}};const chain:any=new Proxy({}, {get(_t,k){if(k==="then")return (r:any)=>r({data:row,error:null});return()=>chain;}});return chain;}};
 assert.deepEqual(await crearRepositorioWebhook(db,"synthetic").referencia("tenant","provider",hashContactoWhatsApp("synthetic","tenant",expected)),{registroId:"delivery",clienteId:"client"});n++;
 assert.equal(await crearRepositorioWebhook(db,"synthetic").referencia("tenant","provider",hashContactoWhatsApp("synthetic","tenant","other")),null);n++;
}
for(const input of [null,"","+","---","letters","++56912345678"]){assert.equal(normalizarTelefonoWhatsApp(input),null);n++;}
console.log(`OK ${n} casos C1 sin red/base.`);
}main().catch(()=>{console.error("FALLO C1");process.exitCode=1;});
