// SQL007 exclusivamente en PGlite efímero, cargado desde runtime externo; sin red/Supabase.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
async function main(){
 const sql=readFileSync(resolve("docs/agente/sql/007_aviso_administrador_borrador.sql"),"utf8");
 assert.ok(sql.startsWith("-- BORRADOR — NO EJECUTAR"));assert.ok(sql.includes("ADD COLUMN IF NOT EXISTS"));assert.ok(sql.includes("pg_advisory_xact_lock"));
 const runtime=process.argv[2];if(!runtime){console.log("OK 3 comprobaciones estáticas C2; PGlite omitido: pasar ruta del runtime como argumento.");return;}
 const {PGlite}=await import(runtime);const db=new PGlite();let n=0;
 await db.exec("CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE TABLE tenants(id uuid PRIMARY KEY);");
 for(let i=0;i<2;i++)for(const file of ["006_eventos_whatsapp_borrador.sql","007_aviso_administrador_borrador.sql"])await db.exec(readFileSync(resolve("docs/agente/sql",file),"utf8"));
 n++;const A="00000000-0000-0000-0000-000000000001",B="00000000-0000-0000-0000-000000000002",h="a".repeat(64),h2="b".repeat(64);
 await db.query("INSERT INTO tenants VALUES ($1),($2)",[A,B]);
 const add=async(i:number,t=A,c=h)=>{const key=`agente-entrada-v1:${i.toString(16).padStart(64,"0")}`;await db.query("INSERT INTO agent_whatsapp_events(event_key,tenant_id,contact_hash,message_hash,received_at) VALUES($1,$2,$3,$3,'2026-10-27T12:00Z')",[key,t,c]);return key;};
 const claim=async(k:string,t=A,c=h,at="2026-10-27T12:00Z")=>(await db.query("SELECT agent_claim_whatsapp_admin_notice($1,$2,$3,$4) AS ok",[t,c,k,at])).rows[0].ok;
 const k1=await add(1),k2=await add(2),k3=await add(3,B),k4=await add(4,A,h2);
 assert.equal(await claim(k1),true);n++;assert.equal(await claim(k2),false);n++;
 assert.equal(await claim(k3,B),true);n++;assert.equal(await claim(k4,A,h2),true);n++;
 assert.equal(await claim(k2,A,h,"2026-10-27T12:59:59Z"),false);n++;
 assert.equal(await claim(k2,A,h,"2026-10-27T13:00Z"),true);n++;
 assert.equal(await claim(k2,A,h,"2026-10-27T14:00Z"),false);n++;
 const k5=await add(5),k6=await add(6);const results=await Promise.all([claim(k5,A,h,"2026-10-27T14:00Z"),claim(k6,A,h,"2026-10-27T14:00Z")]);assert.equal(results.filter(Boolean).length,1);n++;
 await db.exec("SET ROLE anon");await assert.rejects(()=>db.query("SELECT agent_claim_whatsapp_admin_notice($1,$2,$3,$4)",[A,h,k1,"2026-10-27T15:00Z"]));n++;
 await assert.rejects(()=>db.query("SELECT * FROM agent_whatsapp_events"));n++;await db.exec("RESET ROLE");
 assert.equal((await db.query("SELECT relrowsecurity FROM pg_class WHERE relname='agent_whatsapp_events'")).rows[0].relrowsecurity,true);n++;
 assert.equal((await db.query("SELECT count(*)::int n FROM pg_policies WHERE tablename='agent_whatsapp_events'")).rows[0].n,0);n++;
 await assert.rejects(()=>claim(k3,A));n++;
 await db.close();console.log(`OK ${n} casos C2 PGlite; no prueba concurrencia multisession ni correo real.`);
}main().catch(()=>{console.error("FALLO C2 PGlite");process.exitCode=1;});
