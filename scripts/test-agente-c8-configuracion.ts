import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { verificarConfiguracionWhatsApp, CONFIGURACION_WHATSAPP_OPCIONAL } from "../src/lib/agente/whatsapp-meta";
import { crearManejadorRecordatorios } from "../src/lib/agente/recordatorios-whatsapp";
let n=0;const check=(name:string,ok:unknown)=>{n++;assert.ok(ok,name);};
async function main(){
 const names=["WHATSAPP_APP_SECRET","WHATSAPP_VERIFY_TOKEN","AGENTE_CONTACT_HASH_SALT","WHATSAPP_ACCESS_TOKEN","WHATSAPP_API_VERSION","WHATSAPP_REMINDER_TEMPLATE","WHATSAPP_REMINDER_LANGUAGE","EMAIL_FROM"];
 assert.deepEqual(verificarConfiguracionWhatsApp({}),names);n++;
 const env=Object.fromEntries(names.map(k=>[k,`synthetic_value_${k}`]));assert.deepEqual(verificarConfiguracionWhatsApp(env),[]);n++;
 for(const key of names){for(const value of [undefined,"","   ",null,7]){assert.deepEqual(verificarConfiguracionWhatsApp({...env,[key]:value}),[key]);n++;}}
 check("EMAIL_FROM explícitamente opcional/informativa",CONFIGURACION_WHATSAPP_OPCIONAL.includes("EMAIL_FROM"));
 let getter=0;const hostile={...env};Object.defineProperty(hostile,"WHATSAPP_APP_SECRET",{get(){getter++;throw Error("no ejecutar");}});assert.deepEqual(verificarConfiguracionWhatsApp(hostile),["WHATSAPP_APP_SECRET"]);n++;check("no ejecuta getter",getter===0);
 for(const input of [null,undefined,7,"synthetic_secret"]){assert.deepEqual(verificarConfiguracionWhatsApp(input),names);n++;}
 const partial={...env,WHATSAPP_APP_SECRET:"",EMAIL_FROM:""};
 const h=crearManejadorRecordatorios({autorizar:async()=>({ok:true}),configuracion:()=>verificarConfiguracionWhatsApp(partial),crearDependencias:()=>({repo:{negocios:async()=>[]} as any,ahora:Date.now,sal:"synthetic",tieneCuota:async()=>true,consumirCuota:async()=>true,enviarWhatsApp:async()=>({estado:"fallido"}),enviarCorreo:async()=>({estado:"fallido"})})});
 const r=await(await h(new Request("https://test.invalid/?dryRun=1"))).json();assert.deepEqual(r.configuracion_faltante,["WHATSAPP_APP_SECRET","EMAIL_FROM"]);n++;
 check("ningún valor en JSON",!JSON.stringify(r).includes("synthetic_value"));
 const file=resolve("src/lib/agente/limpieza-retencion.ts");
 if(existsSync(file)){
  const {crearManejadorLimpieza}=await import(file);
  const clean=crearManejadorLimpieza({autorizar:async()=>({ok:true}),configuracion:()=>verificarConfiguracionWhatsApp(partial),crearDependencias:()=>({repo:{negocios:async()=>[]},ahora:Date.now}),permitirBorrado:false});
  const res=await(await clean(new Request("https://test.invalid/?dryRun=1"))).json();assert.deepEqual(res.configuracion_faltante,r.configuracion_faltante);n++;check("limpieza no expone valores",!JSON.stringify(res).includes("synthetic_value"));
 }else console.log("Integración C7 omitida en rama independiente; ejecutar también con C7 presente.");
 console.log(`OK ${n} casos C8 sin leer entorno real, red ni llaves.`);
}main().catch(e=>{console.error(e instanceof assert.AssertionError?e.message:"FALLO C8");process.exitCode=1;});
