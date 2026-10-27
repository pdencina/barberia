// F2: verifica que la guía coincide con fixtures existentes y respuestas reales de la FAQ.
// No ejecuta la guía, no lee entorno, no conecta servicios ni envía mensajes.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { responderFaq, type DatosFaq } from "../src/lib/agente/faq-fija";
let casos=0;
const check=(ok:unknown)=>{casos++;assert.ok(ok,"La guía F2 no coincide con las pruebas; revisar sin imprimir mensajes.");};
function main(){
 const guia=readFileSync("docs/agente/PRUEBA-MANUAL-FAQ.md","utf8");
 const fuente=readFileSync("scripts/test-agente-faq-fija.ts","utf8");
 // La suite original no exporta su fixture. Se reutilizan aquí sus valores sintéticos de la línea 5.
 // Estas comprobaciones detectan un cambio de esos datos para que la guía no quede desactualizada.
 for(const literal of ['direccion:"Av. Sintética 123"','telefono:"+56 9 0000 0000"','linkReserva:"https://sintetico.invalid/b/negocio"','nombre:"Corte",precio:10000','nombre:"Barba",precio:5000','nombre:"Color",precio:0','dia===6?"15:00":"20:00"','abre:dia===0?null:"10:00"'])check(fuente.includes(literal));
 const datos:DatosFaq={negocio:{nombre:"Negocio sintético",direccion:"Av. Sintética 123",telefono:"+56 9 0000 0000",linkReserva:"https://sintetico.invalid/b/negocio"},horario:Array.from({length:7},(_,dia)=>({dia,cerrado:dia===0,abre:dia===0?null:"10:00",cierra:dia===0?null:dia===6?"15:00":"20:00"})),servicios:[{nombre:"Corte",precio:10000,duracionMin:30},{nombre:"Barba",precio:5000,duracionMin:20},{nombre:"Color",precio:0,duracionMin:null}]};
 const pasos=Array.from(guia.matchAll(/\*\*Escribe:\*\* `([^`]+)`\s*\n\s*\*\*Debe responder:\*\* `([^`]+)`/g));
 check(pasos.length===8);
 const intenciones:string[]=[];
 for(let i=0;i<pasos.length;i++){
  const [,mensaje,esperado]=pasos[i],r=responderFaq(mensaje,datos);
  const respuesta=r.tipo==="respuesta"?r.texto:"Te contactará una persona.";
  check(respuesta===esperado);
  check(!respuesta.includes(mensaje));
  if(r.tipo==="respuesta")intenciones.push(r.intencion);
  check(i<6?r.tipo==="respuesta":r.tipo==="traspaso");
 }
 check(new Set(intenciones).size===6);
 check((guia.match(/\*\*Si responde otra cosa:\*\*/g)??[]).length===8);
 check((guia.match(/^\d+\. /gm)??[]).length===10);
 check(guia.includes("Minutos 11–15"));
 for(const texto of ["Estudio Levels (pruebas)","no se ejecutó","No actives nada ahora","permitirEnvio","permitirBorrado","false","ABIERTO","ficticios","no repitas"] )check(guia.includes(texto));
 const webhook=readFileSync("src/lib/agente/whatsapp-webhook.ts","utf8");
 check(webhook.includes('await responder("Te contactará una persona.")'));
 check(webhook.includes("deps.avisarAdministrador(n.tenantId)"));
 console.log(`OK ${casos} comprobaciones F2; guía no ejecutada, sin servicios ni mensajes reales.`);
}
try{main();}catch{console.error("FALLO F2: revisar guía y fixture; detalles de mensajes omitidos.");process.exitCode=1;}
