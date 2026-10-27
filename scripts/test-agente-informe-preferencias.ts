import assert from "node:assert/strict";
import { crearManejadoresPreferenciasInforme } from "../src/lib/agente/informe-preferencias";

const tenant = "00000000-0000-4000-8000-000000000001";
const otherTenant = "00000000-0000-4000-8000-000000000002";
const admin = "00000000-0000-4000-8000-000000000011";
const otherAdmin = "00000000-0000-4000-8000-000000000012";
const table = "agent_admin_report_preferences";
const initial = () => ({ profile_id: admin, tenant_id: tenant, enabled: false, frequency: "daily", custom_weekdays: [], weekly_weekday: null, anchor_date: null, send_local_time: null, effective_from: null, revision: 1 });
type Options = { role?: string; noSession?: boolean; guardReject?: number; missing?: string; missingWrite?: string; existing?: boolean; inactive?: boolean; profileTenant?: string; targetRole?: string; stale?: boolean; uniqueRace?: boolean; dbFailure?: boolean };
function fixture(options: Options = {}) {
  const traces: { table: string; operation: string; filters: Record<string, unknown>; payload?: any }[] = [];
  let row: any = options.existing ? initial() : null;
  const db = {
    from(name: string) {
      const trace = { table: name, operation: "read", filters: {} as Record<string, unknown>, payload: undefined as any };
      const chain = {
        select(_: string) { return chain; },
        eq(key: string, value: unknown) { trace.filters[key] = value; return chain; },
        update(value: any) { trace.operation = "update"; trace.payload = value; return chain; },
        insert(value: any) { trace.operation = "insert"; trace.payload = value; return chain; },
        async maybeSingle() {
          traces.push(trace);
          if (options.dbFailure) throw new Error("fallo simulado sin datos reales");
          if (name === "profiles") {
            const requested = trace.filters.id;
            const profile = { id: requested, tenant_id: options.profileTenant ?? tenant, role: options.targetRole ?? "admin", active: !options.inactive };
            return { data: profile.tenant_id === trace.filters.tenant_id ? profile : null, error: null };
          }
          assert.equal(name, table);
          if (options.missing) return { data: null, error: { code: options.missing } };
          if (trace.operation === "read") return { data: row, error: null };
          if (options.missingWrite) return { data: null, error: { code: options.missingWrite } };
          if (options.uniqueRace) return { data: null, error: { code: "23505" } };
          if (options.stale) return { data: null, error: null };
          const identity = trace.operation === "insert" ? trace.payload : { profile_id: trace.filters.profile_id, tenant_id: trace.filters.tenant_id };
          row = { ...initial(), ...identity, ...trace.payload, revision: trace.operation === "insert" ? 1 : (row?.revision ?? 1) + 1 };
          return { data: row, error: null };
        },
      };
      return chain;
    },
  };
  const handlers = crearManejadoresPreferenciasInforme({
    autorizar: async () => options.guardReject ? { ok: false, response: new Response("guard", { status: options.guardReject }) }
      : { ok: true, userId: options.noSession ? "" : admin, role: options.role ?? "admin", tenantId: tenant },
    crearBase: () => db,
  });
  const request = (method: "GET" | "PUT", body?: unknown, query = "", headers?: Record<string, string>) => new Request(`https://ejemplo.invalid/api/agente/informe-preferencias${query}`, { method, headers: { "Content-Type": "application/json", ...headers }, ...(method === "PUT" ? { body: JSON.stringify(body) } : {}) });
  return { handlers, request, traces };
}
let checks = 0;
async function check(label: string, fn: () => Promise<void>) { await fn(); checks++; console.log(`OK ${label}`); }
const activate = { enabled: true, effective_from: "2026-10-27", send_local_time: "08:17" }; // fixture, no valor por defecto del producto

async function main() {
  for (const method of ["GET", "PUT"] as const) {
    for (const [opts, expected] of [[{ noSession: true },401], [{ role:"barber" },403], [{ role:"receptionist" },403], [{ guardReject:401 },401], [{ guardReject:403 },403]] as const) {
      await check(`${method} sesión/rol ${JSON.stringify(opts)} -> ${expected}`,async()=>{const f=fixture(opts);assert.equal((await f.handlers[method](f.request(method,{enabled:false}))).status,expected);assert.equal(f.traces.length,0);});
    }
    for(const query of [`?profileId=${otherAdmin}`,`?tenantId=${otherTenant}`,`?profileId=${admin}&tenantId=${tenant}`]) {
      await check(`${method} admin no selecciona perfil/tenant por query`,async()=>{const f=fixture();assert.equal((await f.handlers[method](f.request(method,{enabled:false},query))).status,403);assert.equal(f.traces.length,0);});
    }
    for(const query of ["",`?profileId=${otherAdmin}`,`?profileId=${otherAdmin}&tenantId=ALL`,`?profileId=incorrecto&tenantId=${tenant}`]) {
      await check(`${method} super_admin exige perfil y negocio concreto`,async()=>{const f=fixture({role:"super_admin"});assert.equal((await f.handlers[method](f.request(method,{enabled:false},query))).status,400);assert.equal(f.traces.length,0);});
    }
    for(const code of ["42P01","PGRST205","42703","PGRST204"]) await check(`${method} falta migración ${code} ->503 apagado`,async()=>{const f=fixture({missing:code});const r=await f.handlers[method](f.request(method,{enabled:false}));assert.equal(r.status,503);assert.deepEqual(await r.json(),{error:"Falta aplicar la migración",enabled:false});});
    for(const opts of [{inactive:true},{targetRole:"receptionist"},{profileTenant:otherTenant}]) await check(`${method} perfil activo/rol/tenant se revalida`,async()=>{const f=fixture(opts);assert.equal((await f.handlers[method](f.request(method,{enabled:false}))).status,403);assert.equal(f.traces.length,1);});
  }
  await check("GET sin fila devuelve apagado sin INSERT",async()=>{const f=fixture();const r=await f.handlers.GET(f.request("GET"));assert.equal(r.status,200);const b=await r.json();assert.equal(b.preference.enabled,false);assert.equal(b.preference.send_local_time,null);assert.equal(b.preference.effective_from,null);assert.equal(b.preference.profile_id,admin);assert.ok(f.traces.every(t=>t.operation==="read"));});
  await check("GET fila existente no expone correo",async()=>{const f=fixture({existing:true});const r=await f.handlers.GET(f.request("GET"));const b=await r.json();assert.equal(b.preference.revision,1);assert.ok(!("email" in b.preference));});
  await check("PUT crea apagado y usa exclusivamente identidad de sesión",async()=>{const f=fixture();const r=await f.handlers.PUT(f.request("PUT",{frequency:"daily"}));assert.equal(r.status,200);const write=f.traces.find(t=>t.operation==="insert")!;assert.equal(write.payload.profile_id,admin);assert.equal(write.payload.tenant_id,tenant);assert.equal(write.payload.enabled,false);assert.ok(!("revision" in write.payload));});
  await check("PUT activa con campos requeridos explícitos",async()=>{const f=fixture();const r=await f.handlers.PUT(f.request("PUT",activate));assert.equal(r.status,200);assert.equal((await r.json()).preference.send_local_time,activate.send_local_time);});
  await check("PUT actualización incluye revisión y ambos filtros",async()=>{const f=fixture({existing:true});const r=await f.handlers.PUT(f.request("PUT",activate));assert.equal(r.status,200);const write=f.traces.find(t=>t.operation==="update")!;assert.deepEqual(write.filters,{profile_id:admin,tenant_id:tenant,revision:1});assert.ok(!("profile_id" in write.payload));});
  await check("toda lectura de preferencia filtra perfil y tenant",async()=>{const f=fixture({existing:true});await f.handlers.GET(f.request("GET"));assert.deepEqual(f.traces[0].filters,{id:admin,tenant_id:tenant});assert.deepEqual(f.traces[1].filters,{profile_id:admin,tenant_id:tenant});});
  for (const extra of ["email","recipients","tenant_id","profile_id","tenantId","profileId","revision","role","created_at","__proto__"]) await check(`PUT whitelist rechaza ${extra}`,async()=>{const f=fixture();const b=JSON.parse(`{"${extra}":"valor-ficticio","enabled":false}`);assert.equal((await f.handlers.PUT(f.request("PUT",b))).status,400);assert.equal(f.traces.length,0);});
  const invalid: unknown[] = [null,[],{}, {enabled:"true"}, {frequency:"invalid"}, {enabled:true}, {...activate,send_local_time:null}, {...activate,effective_from:null}, {...activate,effective_from:"2026-02-31"}, {anchor_date:"2026-04-31"}, {send_local_time:"24:00"}, {send_local_time:"8:00"}, {send_local_time:8}, {custom_weekdays:[1,1]}, {custom_weekdays:[7]}, {custom_weekdays:[-1]}, {custom_weekdays:[1.5]}, {custom_weekdays:["1"]}, {custom_weekdays:null}, {weekly_weekday:7}, {weekly_weekday:1}, {frequency:"custom",enabled:true,effective_from:activate.effective_from,send_local_time:activate.send_local_time}, {...activate,frequency:"every_3_days"}, {...activate,frequency:"weekly"}, {frequency:"daily",custom_weekdays:[1]}];
  for(const body of invalid) await check(`PUT inválido ${JSON.stringify(body)}`,async()=>{const f=fixture();assert.equal((await f.handlers.PUT(f.request("PUT",body))).status,400);assert.ok(!f.traces.some(t=>t.operation!=="read"));});
  for(const body of [{...activate,frequency:"weekly",weekly_weekday:0}, {...activate,frequency:"custom",custom_weekdays:[0,6]}, {...activate,frequency:"every_3_days",anchor_date:"2026-10-27"}, {...activate,effective_from:"2028-02-29"}, {...activate,send_local_time:"09:05:30"}]) await check(`PUT configuración válida ${"frequency" in body ? body.frequency : "daily"}`,async()=>{const f=fixture();assert.equal((await f.handlers.PUT(f.request("PUT",body))).status,200);});
  await check("super_admin gestiona otro administrador del tenant explícito",async()=>{const f=fixture({role:"super_admin"});const r=await f.handlers.PUT(f.request("PUT",{enabled:false},`?profileId=${otherAdmin}&tenantId=${tenant}`));assert.equal(r.status,200);assert.equal(f.traces.find(t=>t.operation==="insert")!.payload.profile_id,otherAdmin);});
  await check("super_admin perfil de otro negocio falla cerrado",async()=>{const f=fixture({role:"super_admin",profileTenant:otherTenant});assert.equal((await f.handlers.GET(f.request("GET",undefined,`?profileId=${otherAdmin}&tenantId=${tenant}`))).status,403);});
  await check("conflicto de revisión no pisa una baja concurrente",async()=>{const f=fixture({existing:true,stale:true});assert.equal((await f.handlers.PUT(f.request("PUT",activate))).status,409);});
  await check("INSERT concurrente da conflicto sin sobrescribir",async()=>{const f=fixture({uniqueRace:true});assert.equal((await f.handlers.PUT(f.request("PUT",activate))).status,409);});
  await check("tabla desaparece al escribir ->503",async()=>{const f=fixture({missingWrite:"42P01"});assert.equal((await f.handlers.PUT(f.request("PUT",activate))).status,503);});
  for(const headers of ([{origin:"https://otro.invalid"},{"sec-fetch-site":"cross-site"}] as Record<string,string>[])) await check("PUT rechaza origen cruzado antes de base",async()=>{const f=fixture();assert.equal((await f.handlers.PUT(f.request("PUT",activate,"",headers))).status,403);assert.equal(f.traces.length,0);});
  await check("PUT mismo origen permitido",async()=>{const f=fixture();assert.equal((await f.handlers.PUT(f.request("PUT",{enabled:false},"",{origin:"https://ejemplo.invalid"}))).status,200);});
  await check("JSON malformado se rechaza antes de base",async()=>{const f=fixture();const r=await f.handlers.PUT(new Request("https://ejemplo.invalid/api/agente/informe-preferencias",{method:"PUT",body:"{"}));assert.equal(r.status,400);assert.equal(f.traces.length,0);});
  await check("parámetros duplicados o extra rechazados",async()=>{for(const q of ["?foo=1",`?profileId=${otherAdmin}&profileId=${admin}&tenantId=${tenant}`]) {const f=fixture({role:"super_admin"});assert.equal((await f.handlers.GET(f.request("GET",undefined,q))).status,400);assert.equal(f.traces.length,0);}});
  await check("excepción de base no expone mensaje interno",async()=>{const f=fixture({dbFailure:true});const r=await f.handlers.GET(f.request("GET"));assert.equal(r.status,500);assert.ok(!(await r.text()).includes("fallo simulado"));});
  console.log(`RESULTADO: ${checks} casos, 0 fallas; guard/base simulados, sin red/llaves/correos.`);
}
main().catch(e=>{console.error(e);process.exitCode=1;});
