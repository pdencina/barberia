import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { enviarInformeConResultado, sendDailyReportEmail } from "../src/lib/agente/informe-diario-email";
import { crearManejadorInformeManual } from "../src/lib/agente/informe-diario-manual";
import type { DependenciasInformeManual } from "../src/lib/agente/informe-diario-manual";

const report = { tenantId: "negocio-ficticio", businessName: "Negocio ficticio", date: "2026-10-27", totalAppointments: 0, pendingAppointments: 0, cancelledAppointments: 0, noShowAppointments: 0, professionals: [] };
const fallback = "re-booking <no-reply@re-booking.cl>";
const args = { report, recipients: ["admin@ejemplo.invalid"], generadoEn: Date.UTC(2026,9,28,0) };
let checks = 0;
async function test(label: string, fn: () => Promise<void>) { await fn(); checks++; console.log(`OK ${label}`); }
function fixture(from: string | undefined) {
  const sent: any[] = [];
  let dbCalls = 0;
  const emailDeps = { remitente: () => from, ahora: () => args.generadoEn, cliente: () => ({ emails: { send: async (payload: any) => { sent.push(payload); return { data: { id: "proveedor-ficticio" }, error: null }; } } }) };
  const deps: DependenciasInformeManual = {
    usuario: async () => ({ userId: "perfil-ficticio" }),
    gestor: async () => ({ ok: true }), negocio: async () => ({ denied: false, tenantId: report.tenantId }), hoy: () => report.date,
    base: () => { dbCalls++; return { from(name: string) { assert.equal(name,"tenants"); const query = { select(fields: string) { assert.equal(fields,"name"); return query; }, eq(key: string,value: string) { assert.equal(key,"id"); assert.equal(value,report.tenantId); return query; }, async maybeSingle() { return { data: { name: report.businessName }, error: null }; } }; return query; } }; },
    configuracion: async (_db,tenantId) => { assert.equal(tenantId,report.tenantId); return { status: "ready", recipients: args.recipients }; },
    informe: async (_db,options) => { assert.equal(options.tenantId,report.tenantId); assert.equal(options.date,report.date); return report; },
    enviar: options => sendDailyReportEmail({ ...options, generadoEn: args.generadoEn },emailDeps),
  };
  return { sent, emailDeps, deps, dbCalls: () => dbCalls, run: () => crearManejadorInformeManual(deps)(new NextRequest("https://ejemplo.invalid/api/agente/informe-diario",{method:"POST",body:JSON.stringify({date:report.date})})) };
}
async function main() {
  for (const [name,from,expected] of [["ausente",undefined,fallback],["válido","Remitente <remitente@ejemplo.invalid>","Remitente <remitente@ejemplo.invalid>"],["vacío","",fallback],["solo espacios","   ",fallback]] as const) {
    await test(`envío compartido: EMAIL_FROM ${name}`,async()=>{const f=fixture(from);assert.equal((await enviarInformeConResultado(args,f.emailDeps)).estado,"aceptado");assert.equal(f.sent.length,1);assert.equal(f.sent[0].from,expected);});
    await test(`POST manual: EMAIL_FROM ${name}`,async()=>{const f=fixture(from);const res=await f.run();assert.equal(res.status,200);assert.equal((await res.json()).sent,true);assert.equal(f.sent.length,1);assert.equal(f.sent[0].from,expected);assert.deepEqual(f.sent[0].to,args.recipients);});
  }
  await test("manual sin sesión: 401, sin base ni proveedor",async()=>{const f=fixture(undefined);f.deps.usuario=async()=>({userId:null});assert.equal((await f.run()).status,401);assert.equal(f.dbCalls(),0);assert.equal(f.sent.length,0);});
  await test("manual sin rol permitido: 403, sin base ni proveedor",async()=>{const f=fixture(undefined);f.deps.gestor=async()=>({ok:false});assert.equal((await f.run()).status,403);assert.equal(f.dbCalls(),0);assert.equal(f.sent.length,0);});
  await test("manual negocio no autorizado: 403, sin base ni proveedor",async()=>{const f=fixture(undefined);f.deps.negocio=async()=>({denied:true,tenantId:null});assert.equal((await f.run()).status,403);assert.equal(f.dbCalls(),0);assert.equal(f.sent.length,0);});
  for(const [status,expected] of [["disabled",409],["missing_migration",503]] as const) await test(`manual ${status}: no envía`,async()=>{const f=fixture(undefined);f.deps.configuracion=async()=>({status,recipients:[]});assert.equal((await f.run()).status,expected);assert.equal(f.sent.length,0);});
  await test("manual sin destinatarios: 409 sin proveedor",async()=>{const f=fixture(undefined);f.deps.configuracion=async()=>({status:"ready",recipients:[]});assert.equal((await f.run()).status,409);assert.equal(f.sent.length,0);});
  console.log(`RESULTADO: ${checks} casos, 0 fallas; handler real de POST con sesión/base/proveedor simulados, sin correo real.`);
}
main().catch(error=>{console.error(error);process.exitCode=1;});
