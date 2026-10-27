import assert from "node:assert/strict";
import { seleccionarRecordatorioUnico } from "../src/lib/agente/referencia-alternativa";
import { hashContactoWhatsApp } from "../src/lib/agente/whatsapp-meta";
const now=Date.UTC(2026,9,27,18),sal="synthetic",hash=hashContactoWhatsApp(sal,"A","56912345678");
const client={id:"c",tenant_id:"A",phone:"09 1234-5678"};
const record={id:"delivery",tenant_id:"A",appointment_id:"appt",channel:"whatsapp",purpose:"recordatorio-cita-v1",status:"aceptado_proveedor",provider_accepted_at:"2026-10-27T17:00Z",provider_message_id:"provider",appointment:{id:"appt",tenant_id:"A",client_id:"c",start_time:"2026-10-28T15:00:00Z"}};
let n=0;const run=(records:any[],clients:any[]=[client])=>seleccionarRecordatorioUnico("A",hash,now,clients,records,sal);
assert.equal(run([]),null);n++;
assert.deepEqual(run([record]),{registroId:"delivery",clienteId:"c"});n++;
for(const r of [ {...record,id:"second"}, {...record,tenant_id:"B"}, {...record,appointment:{...record.appointment,client_id:"other"}}, {...record,appointment:{...record.appointment,start_time:"2026-10-27T14:59:59Z"}}, {...record,provider_accepted_at:"2026-10-25T17:59:59.999Z"}, {...record,provider_accepted_at:"2026-10-27T18:00:00.001Z"}, {...record,channel:"email"}, {...record,status:"incierto"}, {...record,provider_message_id:null}]){
 if(r.id==="second")assert.equal(run([record,r]),null);else assert.equal(run([r]),null);n++;
}
assert.equal(run([record],[client,{...client,id:"other",phone:"+56912345678"}]),null);n++;
assert.deepEqual(run([record],[client,{...client,id:"other",tenant_id:"B"}]),{registroId:"delivery",clienteId:"c"});n++;
assert.deepEqual(run([{...record,provider_accepted_at:"2026-10-25T18:00Z"}]),{registroId:"delivery",clienteId:"c"});n++;
console.log(`OK ${n} casos C5, sin red/base.`);
