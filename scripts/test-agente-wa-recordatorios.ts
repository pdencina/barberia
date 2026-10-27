// Especificación ejecutable con repositorio/proveedores simulados; sin red/base/llaves.
import assert from "node:assert/strict";
import { crearManejadorRecordatorios, crearRepositorioRecordatorios, ventanaRecordatorios, MAX_ENVIOS_RECORDATORIOS, MigracionRecordatoriosPendiente, type CitaRecordatorio, type DependenciasRecordatorios } from "../src/lib/agente/recordatorios-whatsapp";
import { crearAutorizadorInformeProgramado } from "../src/lib/agente/informe-programado";
import { hashContactoWhatsApp, extraerMensajesEntrantes } from "../src/lib/agente/whatsapp-meta";
let cases=0;
const check=(n:string,ok:unknown)=>{cases++;assert.ok(ok,n);};
const now=Date.UTC(2026,9,27,12),sal="sal_sintetica";
const cita=(id="apptA",tenant="tenantA"):CitaRecordatorio=>({id,tenant_id:tenant,status:"scheduled",start_time:"2026-10-28T09:00:00.000Z",date:"2026-10-28",reminder_sent:false,client:{id:"clientA",tenant_id:tenant,name:"Nombre Sintetico",phone:"+10000000001",email:"synthetic@example.invalid"},barber:{name:"Profesional Sintetico"},services:[{service:{name:"Servicio Sintetico"}}]});
function fixture(rows=[cita()]) {
  const claims=new Map<string,{id:string;status:string;provider?:string}>(),bajas=new Set<string>();
  let wa=0,email=0,consume=0,reservas=0,enabled=true;
  const negocios=[{tenantId:"tenantA",phoneNumberId:"1001",enabled:true},{tenantId:"tenantB",phoneNumberId:"2002",enabled:true}];
  const key=(c:CitaRecordatorio,ch:string)=>`${c.tenant_id}:${c.id}:${ch}`;
  const deps:DependenciasRecordatorios={sal,ahora:()=>now,
    repo:{
      negocios:async()=>negocios.map(n=>({...n,enabled:n.enabled&&enabled})),
      negocio:async t=>{const n=negocios.find(n=>n.tenantId===t);return n?{...n,enabled:n.enabled&&enabled}:null;},
      citas:async t=>rows.filter(c=>c.tenant_id===t),actual:async c=>rows.find(r=>r.id===c.id&&r.tenant_id===c.tenant_id)??null,
      baja:async(t,h)=>bajas.has(`${t}:${h}`),existe:async(c,ch)=>claims.has(key(c,ch)),
      reclamar:async(c,ch)=>{const k=key(c,ch);if(claims.has(k))return null;const id=`claim${claims.size}`;claims.set(k,{id,status:"procesando"});return id;},
      finalizar:async(c,ch,id,status,_now,provider)=>{const r=claims.get(key(c,ch));if(!r||r.id!==id||r.status!=="procesando")throw Error("CAS perdido");r.status=status;r.provider=provider;},
      reservarContraCronCorreo:async c=>{const r=rows.find(x=>x.id===c.id&&x.tenant_id===c.tenant_id);if(!r||r.reminder_sent)return false;r.reminder_sent=true;reservas++;return true;},
    },
    tieneCuota:async()=>true,consumirCuota:async()=>{consume++;return true;},
    enviarWhatsApp:async()=>{wa++;return {estado:"aceptado",id:"wamid.synthetic"};},enviarCorreo:async()=>{email++;return {estado:"aceptado",id:"email.synthetic"};},
  };
  const handler=(permitirEnvio=true,auth:()=>Promise<{ok:true}|{ok:false;status:401|503}>=async()=>({ok:true}))=>crearManejadorRecordatorios({permitirEnvio,autorizar:auth,crearDependencias:()=>deps});
  const request=(dry=false)=>new Request(`https://test.invalid/recordatorios${dry?"?dryRun=1":""}`);
  const run=async(dry=false)=>await(await handler()(request(dry))).json();
  return {deps,claims,bajas,rows,negocios,handler,request,run,counts:()=>({wa,email,consume,reservas}),off:()=>{enabled=false;}};
}
async function main(){
  let f=fixture();let r=await f.run();
  check("aceptado queda registrado con provider id",r.whatsapp===1&&f.claims.get("tenantA:apptA:whatsapp")?.provider==="wamid.synthetic");
  check("no correo en éxito",f.counts().email===0);
  check("una cuota por ganador",f.counts().consume===1);
  check("puente antes de envío",f.counts().reservas===1&&f.rows[0].reminder_sent);
  await f.run();check("repetir no manda otra vez",f.counts().wa===1);
  f=fixture();f.bajas.add(`tenantA:${hashContactoWhatsApp(sal,"tenantA","10000000001")}`);r=await f.run();
  check("baja no envía ni consume ni reclama",r.omitidos===1&&f.counts().wa===0&&f.counts().consume===0&&f.claims.size===0);
  f=fixture();f.deps.tieneCuota=async()=>false;r=await f.run();
  check("cuota agotada sin ningún canal ni reclamo",r.sin_cuota===1&&f.counts().wa===0&&f.counts().email===0&&f.claims.size===0);
  f=fixture();f.deps.consumirCuota=async()=>false;r=await f.run();
  check("cuota agotada entre lectura y débito no envía",r.sin_cuota===1&&f.counts().wa===0&&f.claims.get("tenantA:apptA:whatsapp")?.status==="fallido");
  f=fixture();const parallel=await Promise.all([f.run(),f.run()]);
  check("dos ejecuciones un reclamo y envío",f.counts().wa===1&&f.counts().consume===1&&parallel.reduce((s,x)=>s+x.whatsapp,0)===1);
  f=fixture();f.deps.enviarWhatsApp=async()=>({estado:"fallido"});r=await f.run();
  check("fallo inequívoco usa respaldo",r.correos===1&&f.counts().email===1&&f.claims.get("tenantA:apptA:email")?.status==="aceptado_proveedor");
  check("canales separados",f.claims.get("tenantA:apptA:whatsapp")?.status==="fallido"&&f.claims.size===2);
  f=fixture();f.deps.enviarWhatsApp=async()=>({estado:"fallido"});f.claims.set("tenantA:apptA:email",{id:"existing",status:"aceptado_proveedor"});await f.run();
  check("correo ya registrado no se duplica",f.counts().email===0);
  f=fixture();f.rows[0].reminder_sent=true;await f.run();check("correo cron anterior ya marcado no vuelve a contactar",f.counts().wa===0&&f.counts().email===0);
  for(const result of ["incierto","throw"]){
    f=fixture();f.deps.enviarWhatsApp=async()=>{if(result==="throw")throw Error("dato privado");return {estado:"incierto"};};r=await f.run();
    check("incierto/exception no respaldo",r.inciertos===1&&f.counts().email===0&&f.claims.get("tenantA:apptA:whatsapp")?.status==="incierto");
    await f.run();check("incierto no reintenta",f.claims.size===1);
  }
  f=fixture();f.off();r=await f.run();check("negocio apagado",r.procesados===0&&f.counts().wa===0);
  f=fixture([cita(),cita("apptB","tenantB")]);f.bajas.add(`tenantA:${hashContactoWhatsApp(sal,"tenantA","10000000001")}`);r=await f.run();
  check("dos negocios sin mezclar baja",r.whatsapp===1&&f.claims.has("tenantB:apptB:whatsapp")&&!f.claims.has("tenantA:apptA:whatsapp"));
  f=fixture();f.deps.repo.citas=async t=>[cita("cross",t==="tenantA"?"tenantB":"tenantA")];await f.run();check("adapter malicioso no cruza tenant",f.counts().wa===0&&f.claims.size===0);
  f=fixture();f.rows[0].client!.tenant_id="tenantB";await f.run();check("cliente de otro negocio rechazado",f.counts().wa===0);
  f=fixture();f.rows[0].client!.phone="900000000";await f.run();check("normaliza número local a Chile",f.counts().wa===1);
  f=fixture();f.rows[0].start_time="2026-10-28T09:00:00+00:00";r=await f.run();check("normaliza formato SQL sin desplazar la hora",r.whatsapp===1);
  f=fixture();f.rows[0].start_time="2026-10-28T18:00:00Z";await f.run();check("fuera de ventana no envía",f.counts().wa===0);
  f=fixture();r=await f.run(true);check("dryRun solo lecturas",r.candidatos===1&&f.claims.size===0&&f.counts().consume===0&&f.counts().reservas===0&&f.counts().wa===0);
  f=fixture();let built=0;
  let h=crearManejadorRecordatorios({autorizar:async()=>({ok:false,status:401}),crearDependencias:()=>{built++;return f.deps;},permitirEnvio:true});
  check("cron antes de dependencias también dryRun",(await h(f.request(true))).status===401&&built===0);
  h=crearManejadorRecordatorios({autorizar:async()=>({ok:true}),crearDependencias:()=>{built++;return f.deps;}});
  const blocked=await h(f.request());check("bloqueado por defecto antes de construir base",blocked.status===503&&built===0&&(await blocked.json()).bloqueado_coordinacion===1);
  const auth=crearAutorizadorInformeProgramado(()=>({CRON_SECRET:"cron_synthetic",NODE_ENV:"test"}));
  check("verifyCron compartido rechaza",!(await auth(f.request(true))).ok);
  check("verifyCron compartido admite bearer",(await auth(new Request("https://test.invalid/?dryRun=1",{headers:{authorization:"Bearer cron_synthetic"}}))).ok);
  f=fixture();await f.run();f.rows[0].start_time="2026-10-28T10:00:00Z";f.rows[0].reminder_sent=false;await f.run();
  check("reprogramar no inventa autorización para reenviar",f.counts().wa===1);
  f=fixture();let failOnlyWa=true;const finish=f.deps.repo.finalizar;
  f.deps.repo.finalizar=async(...args)=>{if(args[1]==="email"&&failOnlyWa){failOnlyWa=false;throw Error("persistencia email");}return finish(...args);};
  f.deps.enviarWhatsApp=async()=>({estado:"fallido"});r=await f.run();await f.run();
  check("aceptación de email sin persistencia queda incierta sin reenvío",r.inciertos===1&&f.counts().email===1&&f.claims.get("tenantA:apptA:email")?.status==="incierto");
  f=fixture();f.deps.repo.negocios=async()=>{throw new MigracionRecordatoriosPendiente();};r=await f.run();check("migración ausente conteo sin datos",r.migracion_pendiente===1&&f.counts().wa===0);
  f=fixture();const old=f.deps.consumirCuota;f.deps.consumirCuota=async(...args)=>{f.bajas.add(`tenantA:${hashContactoWhatsApp(sal,"tenantA","10000000001")}`);return old(...args);};await f.run();
  check("baja aparecida después del reclamo se respeta",f.counts().wa===0);
  f=fixture();f.deps.repo.reservarContraCronCorreo=async()=>false;await f.run();check("cron ganó reserva no envía WhatsApp",f.counts().wa===0);
  f=fixture();f.deps.repo.finalizar=async()=>{throw Error("fallo persistencia");};r=await f.run();check("aceptación sin registro no dispara respaldo",r.inciertos===1&&f.counts().email===0);
  f=fixture();f.deps.enviarWhatsApp=async()=>({estado:"fallido"});f.deps.enviarCorreo=async()=>({estado:"incierto"});r=await f.run();await f.run();
  check("respaldo incierto no reintenta",r.inciertos===1&&f.claims.get("tenantA:apptA:email")?.status==="incierto");
  f=fixture(Array.from({length:50},(_,i)=>cita(`many${i}`)));r=await f.run();check("cota de envíos",r.intentos<=MAX_ENVIOS_RECORDATORIOS&&f.counts().wa<50);
  f=fixture(Array.from({length:50},(_,i)=>cita(`many${i}`)));f.deps.enviarWhatsApp=async()=>({estado:"fallido"});r=await f.run();check("cota incluye respaldos",r.intentos===MAX_ENVIOS_RECORDATORIOS&&r.correos===10);
  const spring=ventanaRecordatorios(Date.UTC(2026,8,5,6));
  check("DST primavera: civil 9h, real 8h",spring.desde==="2026-09-05T22:00:00.000Z"&&spring.hasta==="2026-09-06T07:00:00.000Z");
  const autumn=ventanaRecordatorios(Date.UTC(2026,3,4,6));
  check("DST otoño: civil 7h, real 8h",autumn.desde==="2026-04-04T23:00:00.000Z"&&autumn.hasta==="2026-04-05T06:00:00.000Z");
  f=fixture([({...cita(),date:"2026-09-06",start_time:"2026-09-06T01:30:00Z"})]);f.deps.ahora=()=>Date.UTC(2026,8,5,6);r=await f.run();check("cita cruza medianoche y DST sin UTC falso",r.whatsapp===1);
  f=fixture();r=await f.run();const serialized=JSON.stringify(r);for(const secret of ["10000000001","Nombre Sintetico","Profesional Sintetico","tenantA","apptA","synthetic@example.invalid"])check("respuesta sin datos privados",!serialized.includes(secret));
  const extracted=extraerMensajesEntrantes({object:"whatsapp_business_account",entry:[{changes:[{field:"messages",value:{messaging_product:"whatsapp",metadata:{phone_number_id:"1001"},messages:[{id:"in",from:"10000000001",type:"text",text:{body:"baja"}}]}}]}]},{sal,resolverTenant:()=>"tenantA"});
  check("hash común coincide con el entrante",extracted[0].persistible.remitenteHash===hashContactoWhatsApp(sal,"tenantA","10000000001"));
  // Adapter: paginación >1000, filtro tenant, FK explícita y reclamo ON CONFLICT.
  const queries:{table:string;calls:[string,unknown[]][]}[]=[];
  const db={from(table:string){const q={table,calls:[] as [string,unknown[]][]};queries.push(q);const chain:any=new Proxy({}, {get(_t,k){if(k==="then")return(resolve:any)=>{
    const range=q.calls.find(x=>x[0]==="range")?.[1];
    const data=table==="appointments"?Array.from({length:range?.[0]===0?1000:2},()=>cita()):[];
    resolve({data,error:null});
  };return(...args:unknown[])=>{q.calls.push([String(k),args]);return chain;};}});return chain;}};
  const repo=crearRepositorioRecordatorios(db);const rows=await repo.citas("tenantA",ventanaRecordatorios(now));
  check("pagina 1002 sin truncar",rows.length===1002&&queries.length===2);
  check("cada página aislada y ordenada",queries.every(q=>q.calls.some(([k,a])=>k==="eq"&&a[0]==="tenant_id"&&a[1]==="tenantA")&&q.calls.some(([k,a])=>k==="order"&&a[0]==="id")));
  check("embed profesional explícito",queries.every(q=>String(q.calls.find(([k])=>k==="select")?.[1][0]).includes("profiles!barber_id")));
  await repo.reclamar(cita(),"whatsapp",now);const claim=queries.at(-1)!;
  const upsert=claim.calls.find(([k])=>k==="upsert")![1] as any[];
  check("reclamo atómico sin merge/update",upsert[1].ignoreDuplicates===true&&upsert[1].onConflict==="appointment_id,channel,purpose"&&upsert[0].tenant_id==="tenantA");
  const bad=crearRepositorioRecordatorios({from(){const c:any=new Proxy({}, {get(_t,k){if(k==="then")return(resolve:any)=>resolve({error:{code:"42P01",message:"dato privado"}});return()=>c;}});return c;}});
  let migration=false;try{await bad.citas("tenantA",ventanaRecordatorios(now));}catch(e){migration=e instanceof MigracionRecordatoriosPendiente;}
  check("adapter traduce error de migración sin eco",migration);
  console.log(`OK: ${cases} casos recordatorios; sin red/base/llaves ni mensajes reales.`);
}
main().catch(e=>{console.error(e instanceof assert.AssertionError?e.message:"FALLO de prueba, detalles privados omitidos");process.exitCode=1;});
