import assert from "node:assert/strict";
import { crearAutorizadorInformeProgramado, crearManejadorInformeProgramado, crearRepositorioInformeProgramado, MigracionInformePendiente, MAX_ENVIOS_POR_EJECUCION, type PreferenciaProgramada, type DependenciasInformeProgramado } from "../src/lib/agente/informe-programado";
import { enviarInformeConResultado } from "../src/lib/agente/informe-diario-email";

const instant = Date.UTC(2026, 9, 27, 0); // 21:00 Santiago del día 26
const pref = (id = "perfil-ficticio-a", tenant = "negocio-ficticio-a"): PreferenciaProgramada => ({ profile_id: id, tenant_id: tenant, revision: 1, enabled: true, frequency: "daily", effective_from: "2026-01-01", send_local_time: null, weekly_weekday: null, custom_weekdays: [], anchor_date: null });
type Log = { status: string; fecha: string; started: number; id: string };
function fixture(prefs = [pref()]) {
  let now = instant;
  const logs = new Map<string, Log>();
  const emails = new Map(prefs.map(p => [p.profile_id, `${p.profile_id}@ejemplo.invalid`]));
  const sends: { tenant: string; correo: string; fecha: string }[] = [];
  const writes: string[] = [], reports: string[] = [];
  let factories = 0, guard: 401 | 503 | null = null;
  const key = (p: PreferenciaProgramada, date: string) => JSON.stringify([p.tenant_id, p.profile_id, date]);
  const deps: DependenciasInformeProgramado = {
    ahora: () => now,
    repo: {
      preferencias: async () => prefs.map(p => ({ ...p })),
      procesandoAnteriores: async start => Array.from(logs.values()).filter(l => l.status === "procesando" && l.started < start).length,
      ultimaInformada: async p => Array.from(logs.entries()).filter(([k,l]) => k.startsWith(JSON.stringify([p.tenant_id, p.profile_id]).slice(0,-1)+",") && l.status === "aceptado_proveedor").map(([,l]) => l.fecha).sort().pop() ?? null,
      existe: async (p,date) => logs.has(key(p,date)),
      reclamar: async (p,date,t) => {
        // Test double: punto atómico único; la asignación ocurre antes de ceder control.
        const k=key(p,date); if(logs.has(k)) return null;
        const id=`reclamo-ficticio-${logs.size}`; logs.set(k,{status:"procesando",fecha:date,started:t,id}); writes.push("reclamo"); return id;
      },
      perfil: async p => ({ id:p.profile_id, tenant_id:p.tenant_id, role:"admin", active:true, email:emails.get(p.profile_id)! }),
      negocio: async p => ({id:p.tenant_id,name:"Nombre ficticio privado"}),
      preferencia: async p => ({...p}),
      finalizar: async (_p,id,status) => {const row=Array.from(logs.values()).find(l=>l.id===id);assert.ok(row);row.status=status;writes.push(status);},
    },
    generar: async (tenantId,_name,date) => { reports.push(tenantId); return {tenantId,businessName:"Negocio ficticio",date,totalAppointments:0,pendingAppointments:0,cancelledAppointments:0,noShowAppointments:0,professionals:[]}; },
    enviar: async (report,correo) => {sends.push({tenant:report.tenantId,fecha:report.date,correo});return {estado:"aceptado",id:"proveedor-ficticio"};},
  };
  const run=crearManejadorInformeProgramado({autorizar:async()=>guard ? {ok:false,status:guard} : {ok:true},crearDependencias:()=>{factories++;return deps;}});
  const req=(dry=false)=>new Request(`https://ejemplo.invalid/api/agente/informe-programado${dry?"?dryRun=1":""}`);
  return {deps,logs,sends,writes,reports,emails,key,run,req,setNow:(n:number)=>{now=n;},setGuard:(s:401|503)=>{guard=s;},getFactories:()=>factories};
}
let count=0;
async function test(label:string,fn:()=>Promise<void>){await fn();count++;console.log(`OK ${label}`);}
async function main(){
  for(const [status,dry] of [[503,false],[401,false],[401,true]] as const) await test(`guard simulado ${status}, dryRun=${dry}: cero dependencias`,async()=>{const f=fixture();f.setGuard(status);assert.equal((await f.run(f.req(dry))).status,status);assert.equal(f.getFactories(),0);assert.equal(f.sends.length,0);});
  for (const [env,authorization,status,dry] of [
    [{NODE_ENV:"production"},undefined,503,false],
    [{NODE_ENV:"production",CRON_SECRET:"credencial-sintetica"},"Bearer incorrecto",401,false],
    [{NODE_ENV:"production",CRON_SECRET:"credencial-sintetica"},undefined,401,true],
    [{NODE_ENV:"development"},undefined,401,true],
    [{NODE_ENV:"production",CRON_SECRET:"credencial-sintetica"},"Bearer credencial-sintetica",200,true],
  ] as const) await test(`verifyCron REAL con entorno simulado, dryRun=${dry}, status=${status}`,async()=>{
    const f=fixture();let factories=0;const handler=crearManejadorInformeProgramado({autorizar:crearAutorizadorInformeProgramado(()=>env),crearDependencias:()=>{factories++;return f.deps;}});
    const previous=console.error;const messages:unknown[]=[];console.error=(...a:unknown[])=>{messages.push(a);};let res:Response;
    try{res=await handler(new Request(`https://ejemplo.invalid/api/agente/informe-programado${dry?"?dryRun=1":""}`,{headers:authorization?{authorization}:{}}));}finally{console.error=previous;}
    assert.equal(res!.status,status);assert.equal(factories,status===200?1:0);assert.equal(f.sends.length,0);assert.ok(!JSON.stringify(messages).includes("credencial-sintetica"));
  });
  for(const point of ["preferencias","procesandoAnteriores"] as const) await test(`migración faltante en ${point}: 200 y cero envíos`,async()=>{const f=fixture();f.deps.repo[point]=async()=>{throw new MigracionInformePendiente();};const r=await f.run(f.req());assert.equal(r.status,200);const b=await r.json();assert.equal(b.processed,0);assert.equal(b.motivo,"migracion_pendiente");assert.equal(f.sends.length,0);assert.equal(f.writes.length,0);});
  for(const patch of [{enabled:false},{effective_from:"2026-10-28"},{frequency:"weekly" as const,weekly_weekday:2}]) await test(`no toca ${JSON.stringify(patch)}`,async()=>{const f=fixture([{...pref(),...patch}]);const b=await (await f.run(f.req())).json();assert.equal(b.omitidos_calendario,1);assert.equal(f.sends.length,0);});
  await test("antes de 21:00 no envía",async()=>{const f=fixture();f.setNow(instant-1);assert.equal((await (await f.run(f.req())).json()).omitidos_calendario,1);assert.equal(f.writes.length,0);});
  await test("aceptado anterior del mismo día omite por calendario",async()=>{const f=fixture();f.logs.set(f.key(pref(),"2026-10-26"),{status:"aceptado_proveedor",fecha:"2026-10-26",started:instant-1000,id:"anterior"});assert.equal((await (await f.run(f.req())).json()).omitidos_calendario,1);assert.equal(f.sends.length,0);});
  await test("toca: un envío, destinatario releído y estado aceptado",async()=>{const f=fixture();f.emails.set(pref().profile_id,"actualizado@ejemplo.invalid");const b=await (await f.run(f.req())).json();assert.equal(b.enviados,1);assert.equal(f.sends[0].correo,"actualizado@ejemplo.invalid");assert.equal(f.sends[0].fecha,"2026-10-26");assert.equal(Array.from(f.logs.values())[0].status,"aceptado_proveedor");});
  await test("dos ejecuciones simultáneas: solo un reclamo y un envío",async()=>{const f=fixture();const results=await Promise.all([f.run(f.req()),f.run(f.req())]);const b=await Promise.all(results.map(r=>r.json()));assert.equal(f.sends.length,1);assert.equal(b.reduce((n,r)=>n+r.enviados,0),1);assert.equal(f.logs.size,1);});
  for(const state of ["fallido","incierto","pendiente","procesando"]) await test(`fila previa ${state} NO se reenvía ni cambia`,async()=>{const f=fixture();f.logs.set(f.key(pref(),"2026-10-26"),{status:state,fecha:"2026-10-26",started:instant-1000,id:"anterior"});const b=await (await f.run(f.req())).json();assert.equal(b.ya_reclamados,1);assert.equal(b.procesando_antiguos,state==="procesando"?1:0);assert.equal(f.sends.length,0);assert.equal(f.writes.length,0);});
  const badProfiles=[{active:false},{role:"barber"},{tenant_id:"otro-negocio"},{id:"otro-perfil"},{email:"incorrecto"},{email:"a@ejemplo.invalid\nb@ejemplo.invalid"}];
  for(const patch of badProfiles) await test(`perfil inválido justo antes del envío ${JSON.stringify(patch)}`,async()=>{const f=fixture();const original=f.deps.repo.perfil;let reads=0;f.deps.repo.perfil=async p=>({...((await original(p))!),...(++reads===2?patch:{})});const b=await (await f.run(f.req())).json();assert.equal(b.fallidos,1);assert.equal(f.sends.length,0);assert.equal(Array.from(f.logs.values())[0].status,"fallido");});
  for(const patch of [{enabled:false},{revision:2},{tenant_id:"otro-negocio"}]) await test(`preferencia cambiada durante generación ${JSON.stringify(patch)}`,async()=>{const f=fixture();const read=f.deps.repo.preferencia;let changed=false;const generate=f.deps.generar;f.deps.generar=async(...a)=>{changed=true;return generate(...a);};f.deps.repo.preferencia=async p=>({...((await read(p))!),...(changed?patch:{})});assert.equal((await (await f.run(f.req())).json()).fallidos,1);assert.equal(f.sends.length,0);});
  await test("correo cambiado durante generación usa SOLO dirección nueva",async()=>{const f=fixture();const g=f.deps.generar;f.deps.generar=async(...a)=>{f.emails.set(pref().profile_id,"nuevo@ejemplo.invalid");return g(...a);};await f.run(f.req());assert.equal(f.sends[0].correo,"nuevo@ejemplo.invalid");});
  await test("negocio desaparecido no envía",async()=>{const f=fixture();f.deps.repo.negocio=async()=>null;assert.equal((await (await f.run(f.req())).json()).fallidos,1);assert.equal(f.sends.length,0);});
  await test("informe de tenant incorrecto no llega al proveedor",async()=>{const f=fixture();const generate=f.deps.generar;f.deps.generar=async(...a)=>({...await generate(...a),tenantId:"otro-negocio"});assert.equal((await (await f.run(f.req())).json()).fallidos,1);assert.equal(f.sends.length,0);});
  await test("negocio renombrado entre lecturas cancela informe viejo",async()=>{const f=fixture();let reads=0;f.deps.repo.negocio=async p=>({id:p.tenant_id,name:++reads===1?"Nombre ficticio privado":"Nombre nuevo"});assert.equal((await (await f.run(f.req())).json()).fallidos,1);assert.equal(f.sends.length,0);});
  for(const outcome of ["fallido","incierto","throw"] as const) await test(`proveedor ${outcome}: registra estado y sigue con otro admin`,async()=>{const f=fixture([pref(),pref("perfil-ficticio-b")]);const send=f.deps.enviar;let calls=0;f.deps.enviar=async(...a)=>{if(++calls===1){if(outcome==="throw")throw new Error("dato privado simulado");return {estado:outcome};}return send(...a);};const b=await (await f.run(f.req())).json();assert.equal(b.enviados,1);assert.equal(outcome==="fallido"?b.fallidos:b.inciertos,1);assert.ok(Array.from(f.logs.values()).some(l=>l.status===(outcome==="throw"?"incierto":outcome)));});
  await test("dos negocios: cada informe y destinatario permanecen aislados",async()=>{const f=fixture([pref(),pref("perfil-ficticio-b","negocio-ficticio-b")]);await f.run(f.req());assert.deepEqual(f.reports,["negocio-ficticio-a","negocio-ficticio-b"]);assert.equal(f.sends[1].tenant,"negocio-ficticio-b");assert.equal(f.sends[1].correo,"perfil-ficticio-b@ejemplo.invalid");});
  await test("límite por ejecución y siguiente pasada avanzan sin atascarse",async()=>{const f=fixture(Array.from({length:MAX_ENVIOS_POR_EJECUCION+3},(_,i)=>pref(`perfil-ficticio-${i}`)));await f.run(f.req());assert.equal(f.sends.length,MAX_ENVIOS_POR_EJECUCION);await f.run(f.req());assert.equal(f.sends.length,MAX_ENVIOS_POR_EJECUCION+3);});
  await test("dryRun calcula candidatos sin reclamos, informe ni proveedor",async()=>{const f=fixture();const b=await (await f.run(f.req(true))).json();assert.equal(b.dryRun,true);assert.equal(b.candidatos,1);assert.equal(f.writes.length,0);assert.equal(f.reports.length,0);assert.equal(f.sends.length,0);});
  await test("dryRun no cuenta una fila ya reclamada",async()=>{const f=fixture();f.logs.set(f.key(pref(),"2026-10-26"),{status:"incierto",fecha:"2026-10-26",started:instant,id:"anterior"});const b=await (await f.run(f.req(true))).json();assert.equal(b.candidatos,0);assert.equal(b.ya_reclamados,1);assert.equal(f.writes.length,0);});
  for(const [y,m,d,h,date] of [[2026,3,5,0,"2026-04-04"],[2026,3,6,1,"2026-04-05"],[2026,8,6,1,"2026-09-05"],[2026,8,7,0,"2026-09-06"]] as const) await test(`21:00 local en borde DST ${date}`,async()=>{const f=fixture();f.setNow(Date.UTC(y,m,d,h));await f.run(f.req());assert.equal(f.sends[0].fecha,date);});
  await test("medianoche no recupera el día anterior",async()=>{const f=fixture();f.setNow(Date.UTC(2026,9,27,3));await f.run(f.req());assert.equal(f.sends.length,0);});
  await test("cruce de medianoche mientras genera cancela el envío",async()=>{const f=fixture();f.setNow(Date.UTC(2026,9,27,2,59));const g=f.deps.generar;f.deps.generar=async(...a)=>{f.setNow(Date.UTC(2026,9,27,3));return g(...a);};assert.equal((await (await f.run(f.req())).json()).fallidos,1);assert.equal(f.sends.length,0);});
  await test("fallo al registrar aceptación no elimina ni reintenta reclamo",async()=>{const f=fixture();f.deps.repo.finalizar=async()=>{throw new Error("privado");};const b=await (await f.run(f.req())).json();assert.equal(b.inciertos,1);assert.equal(Array.from(f.logs.values())[0].status,"procesando");await f.run(f.req());assert.equal(f.sends.length,1);});
  await test("ninguna respuesta o console revela datos personales",async()=>{
    const captured:unknown[]=[];const names=["log","error","warn","info","debug"] as const;const saved=names.map(k=>console[k]);
    let body="";try{names.forEach(k=>{console[k]=(...a:unknown[])=>{captured.push(a);};});const f=fixture();body=await (await f.run(f.req())).text();}finally{names.forEach((k,i)=>{console[k]=saved[i];});}
    assert.equal(captured.length,0);assert.ok(!/ficticio|@|Nombre|<html|proveedor/.test(body));const parsed=JSON.parse(body);for(const [key,value] of Object.entries(parsed))assert.equal(typeof value,key==="dryRun"?"boolean":"number");
  });
  await adapterTests();await senderTests();
  console.log(`RESULTADO: ${count} casos, 0 fallas. Base/proveedor/reloj/entorno simulados; verifyCron REAL, sin red ni credenciales reales.`);
}

async function adapterTests(){
  const p=pref();const traces:any[]=[];let missing=false;
  const db={from(table:string){const t:any={table,filters:{},orders:[]};const q:any={
    select(fields:string,opts?:any){t.fields=fields;t.opts=opts;return q;},eq(k:string,v:unknown){t.filters[k]=v;return q;},lt(k:string,v:unknown){t.filters[k]=v;return q;},order(k:string,o:any){t.orders.push([k,o]);return q;},limit(n:number){t.limit=n;return q;},range(a:number,b:number){t.range=[a,b];return q;},upsert(payload:any,opts:any){t.operation="upsert";t.payload=payload;t.conflict=opts;return q;},update(payload:any){t.operation="update";t.payload=payload;return q;},maybeSingle(){t.single=true;return q;},
    then(resolve:any,reject:any){traces.push(t);if(missing)return Promise.resolve({data:null,error:{code:"42P01"}}).then(resolve,reject);const data=t.range?Array.from({length:t.range[0]===0?1000:5},(_,i)=>({...p,profile_id:`perfil-${t.range[0]+i}`})):t.single?{id:"id-ficticio",report_date:"2026-10-25"}:null;return Promise.resolve({data,error:null,count:4}).then(resolve,reject);},
  };return q;}};
  const r=crearRepositorioInformeProgramado(db);
  await test("adapter: 1.005 preferencias, rango/orden estable sin columna id",async()=>{assert.equal((await r.preferencias()).length,1005);assert.deepEqual(traces.map(t=>t.range),[[0,999],[1000,1999]]);assert.ok(traces.every(t=>t.filters.enabled===true&&t.orders[0][0]==="profile_id"));});
  traces.length=0;
  await test("adapter: último aceptado filtra tenant/perfil/propósito/estado",async()=>{await r.ultimaInformada(p);assert.deepEqual(traces[0].filters,{tenant_id:p.tenant_id,profile_id:p.profile_id,purpose:"informe-admin-v1",status:"aceptado_proveedor"});assert.equal(traces[0].limit,1);});
  traces.length=0;
  await test("adapter: reclamo UNA petición ignoreDuplicates con clave exacta",async()=>{await r.reclamar(p,"2026-10-26",instant);assert.equal(traces.length,1);assert.equal(traces[0].operation,"upsert");assert.deepEqual(traces[0].conflict,{onConflict:"profile_id,report_date,purpose",ignoreDuplicates:true});assert.equal(traces[0].payload.status,"procesando");assert.equal(traces[0].payload.attempts,1);assert.ok(!("email" in traces[0].payload));});
  traces.length=0;
  await test("adapter: finalizar filtra identidad/tenant/estado y guarda solo campos permitidos",async()=>{await r.finalizar(p,"id-ficticio","aceptado_proveedor",instant,"proveedor-ficticio");assert.deepEqual(traces[0].filters,{id:"id-ficticio",tenant_id:p.tenant_id,profile_id:p.profile_id,purpose:"informe-admin-v1",status:"procesando"});assert.deepEqual(Object.keys(traces[0].payload).sort(),["status","finished_at","provider_accepted_at","provider_message_id"].sort());});
  await test("adapter: errores de migración conservan señal segura",async()=>{missing=true;await assert.rejects(()=>r.preferencias(),MigracionInformePendiente);});
}
async function senderTests(){
  const f=fixture();const report=await f.deps.generar("negocio-ficticio","Nombre","2026-10-26");
  for(const [result,expected] of [[{data:{id:"ficticio"},error:null},"aceptado"],[{data:null,error:{name:"validation_error"}},"fallido"],[{data:null,error:{name:"application_error",message:"dato privado"}},"incierto"],[{data:null,error:{name:"internal_server_error"}},"incierto"],[{data:null,error:null},"incierto"]] as const)await test(`Resend simulado ${expected}: sin errores crudos`,async()=>{const r=await enviarInformeConResultado({report,recipients:["ficticio@ejemplo.invalid"],generadoEn:instant},{remitente:()=>"remitente@ejemplo.invalid",ahora:()=>instant,cliente:()=>({emails:{send:async payload=>{assert.equal(payload.from,"remitente@ejemplo.invalid");assert.ok(payload.html.includes("Citas de hoy, generado a las 21:00"));return result;}}})});assert.equal(r.estado,expected);assert.ok(!JSON.stringify(r).includes("dato privado"));});
  await test("EMAIL_FROM ausente no construye cliente ni envía",async()=>{const r=await enviarInformeConResultado({report,recipients:["ficticio@ejemplo.invalid"]},{remitente:()=>undefined,ahora:()=>instant,cliente:()=>{throw new Error("no debe construirse");}});assert.equal(r.estado,"fallido");});
  await test("excepción/timeout del transporte es incierto",async()=>{assert.equal((await enviarInformeConResultado({report,recipients:["ficticio@ejemplo.invalid"],generadoEn:instant},{remitente:()=>"remitente@ejemplo.invalid",ahora:()=>instant,cliente:()=>({emails:{send:async()=>{throw new Error("timeout privado");}}})})).estado,"incierto");});
}
main().catch(e=>{console.error(e);process.exitCode=1;});
