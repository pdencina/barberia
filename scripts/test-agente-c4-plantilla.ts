import assert from "node:assert/strict";
import { variablesPlantillaRecordatorio } from "../src/lib/agente/plantilla-recordatorio";
import { extraerMensajesEntrantes } from "../src/lib/agente/whatsapp-meta";
import { clasificarRespuestaCliente } from "../src/lib/agente/respuesta-cliente";
let n=0;const c:any={start_time:"2026-10-28T15:30:00Z",barber:{name:"Profesional sintético"},services:[{service:{name:"Servicio sintético"}}]};
assert.deepEqual(variablesPlantillaRecordatorio(c),["miércoles 28 de octubre, 15:30","15:30","Profesional sintético","Servicio sintético"]);n++;
for(const start_time of ["2026-10-28T15:30:00","2026-10-28T15:30:00+00:00"]){assert.equal(variablesPlantillaRecordatorio({...c,start_time})[0],"miércoles 28 de octubre, 15:30");n++;}
for(const [button,expected] of [[{payload:"Confirmar",text:"Cancelar"},"confirmar"],[{text:"Confirmar"},"confirmar"],[{text:"Cancelar"},"cancelar"],[{payload:"Cancelar",text:"Confirmar"},"cancelar"],[{payload:"",text:"Confirmar"},"desconocido"],[{payload:null,text:"Confirmar"},"desconocido"]] as const){
 const [m]=extraerMensajesEntrantes({object:"whatsapp_business_account",entry:[{changes:[{field:"messages",value:{messaging_product:"whatsapp",metadata:{phone_number_id:"1001"},messages:[{id:"in",from:"56900000000",type:"button",button,context:{id:"provider"}}]}}]}]},{sal:"synthetic",resolverTenant:()=>"tenant"});
 assert.equal(clasificarRespuestaCliente(m.memoria.leerTexto()),expected);n++;assert.equal(m.persistible.context_id,"provider");n++;
}
console.log(`OK ${n} casos C4 sin red/base.`);
