import assert from "node:assert/strict";
import { summarizeAgenda } from "../src/lib/agenda-summary";
import { newClientAppointmentIds } from "../src/lib/new-client";
let passed = 0;
async function test(name: string, fn: () => unknown) { await fn(); passed++; console.log(`OK ${name}`); }
const row = (id: string, status = "scheduled", price: any = 10000, client_id: string | null = id) => ({ id, status, client_id, date: "2026-11-07", start_time: "09:00", services: [{ price }] });
const profile = { commission_rate: 40, work_mode: "commission" };
async function main() {
  await test("citas activas, completadas y porcentaje sobre precios reservados", () => {
    const s = summarizeAgenda([row("a"), row("b", "completed", 20000), row("c", "cancelled"), row("d", "no_show")], new Set(["a"]), profile);
    assert.deepEqual([s.appointments, s.completed, s.newClients, s.expectedIncome], [2, 1, 1, 12000]);
  });
  await test("varios servicios suman dinero pero cuentan una atención", () => {
    const s = summarizeAgenda([{ ...row("a"), services: [{ price: 12000 }, { price: 8000 }] }], new Set(), profile);
    assert.equal(s.appointments, 1); assert.equal(s.expectedIncome, 8000);
  });
  await test("cero por ciento es válido y no se sustituye por 40", () => assert.equal(summarizeAgenda([row("a")], new Set(), { ...profile, commission_rate: 0 }).expectedIncome, 0));
  await test("porcentaje decimal y precio numérico en texto", () => assert.equal(summarizeAgenda([row("a", "scheduled", "10001")], new Set(), { ...profile, commission_rate: 37.5 }).expectedIncome, 3750));
  await test("porcentajes ausentes o inválidos nunca inventan un monto", () => { for (const commission_rate of [null, "", -1, 101, "x"]) assert.equal(summarizeAgenda([row("a")], new Set(), { ...profile, commission_rate }).expectedIncome, null); });
  await test("arriendo no se presenta como comisión", () => assert.equal(summarizeAgenda([row("a")], new Set(), { ...profile, work_mode: "rental" }).expectedIncome, null));
  await test("precios incompletos no subestiman el monto", () => { for (const price of [null, "", -5, "x"]) assert.equal(summarizeAgenda([row("a", "scheduled", price)], new Set(), profile).expectedIncome, null); });
  await test("día vacío devuelve ceros", () => assert.equal(summarizeAgenda([], new Set(), profile).expectedIncome, 0));
  await test("clientes únicos y citas sin ficha identificadas aparte", () => {
    const s = summarizeAgenda([row("a", "scheduled", 10000, "c"), row("b", "completed", 10000, "c"), row("z", "scheduled", 10000, null)], new Set(["a", "b", "z"]), profile);
    assert.equal(s.newClients, 1); assert.equal(s.unlinkedClients, 1);
  });
  await test("error de historial no se muestra como cero nuevos", () => assert.equal(summarizeAgenda([row("a")], null, profile).newClients, null));

  function historyDb(history: any[], error = false) {
    return { from() {
      let tenant: string | undefined, clients: string[] = [], max = "", from = 0, to = 0;
      const q: any = {
        select: () => q, in: (_: string, ids: string[]) => { clients = ids; return q; },
        lte: (_: string, d: string) => { max = d; return q; }, not: () => q, order: () => q,
        eq: (key: string, value: string) => { assert.equal(key, "tenant_id"); tenant = value; return q; },
        range: (a: number, b: number) => { from = a; to = b; return q; },
        then(resolve: any) { const data = history.filter(r => (!tenant || r.tenant_id === tenant) && clients.includes(r.client_id) && r.date <= max && !["cancelled", "no_show"].includes(r.status)).sort((a,b) => (a.date + a.start_time + a.id).localeCompare(b.date + b.start_time + b.id)).slice(from, to + 1); return Promise.resolve({ data, error: error ? { message: "fail" } : null }).then(resolve); },
      }; return q;
    } };
  }
  await test("primera visita del negocio: cuenta atención anterior con otro profesional", async () => {
    const today = { ...row("a"), client_id: "c", tenant_id: "t" };
    const old = { ...today, id: "old", date: "2026-10-01", barber_id: "otro" };
    assert.equal((await newClientAppointmentIds(historyDb([today, old]), [today], { tenantId: "t", strict: true })).size, 0);
  });
  await test("cancelaciones previas y otro negocio no quitan condición de nuevo", async () => {
    const today = { ...row("a"), client_id: "c", tenant_id: "t" };
    const old = { ...today, id: "old", date: "2026-10-01", status: "cancelled" };
    assert.ok((await newClientAppointmentIds(historyDb([today, old, { ...old, status: "completed", tenant_id: "otro" }]), [today], { tenantId: "t", strict: true })).has("a"));
  });
  await test("historial paginado supera 1000 filas", async () => {
    const history = Array.from({ length: 1001 }, (_, i) => ({ ...row(String(i)), client_id: "c", tenant_id: "t" }));
    const today = { ...row("new"), client_id: "new-client", tenant_id: "t" };
    assert.ok((await newClientAppointmentIds(historyDb([...history, today]), [history[0], today], { tenantId: "t", strict: true })).has("new"));
  });
  await test("historial fallido lanza error en modo estricto", async () => await assert.rejects(() => newClientAppointmentIds(historyDb([], true), [row("a")], { tenantId: "t", strict: true })));

  // Ejecutar el handler real con fronteras externas simuladas, sin red ni credenciales.
  const Module = require("node:module"); const originalLoad = Module._load;
  let caller: any = { userId: "admin", role: "admin", tenantId: "t" };
  let exists = true; let queries = 0;
  const fakeDb = { from() { queries++; const q: any = { select: () => q, eq: (key: string, value: string) => { if (key === "tenant_id") assert.equal(value, "t"); return q; }, in: () => q, maybeSingle: async () => ({ data: exists ? profile : null, error: null }) }; return q; } };
  Module._load = function(id: string, ...args: any[]) {
    if (id === "@/lib/supabase/server") return { getCallerForView: async () => caller, createAdminSupabase: () => fakeDb };
    if (id === "@/lib/accounting") return { fetchAllRows: async (build: any) => { build(); return []; } };
    if (id === "@/lib/utils") return { todayInChile: () => "2026-11-07" };
    return originalLoad.call(this, id, ...args);
  };
  const { GET } = require("../src/app/api/barber/agenda/resumen/route");
  Module._load = originalLoad;
  const request = (barberId = "pro", date = "2026-11-07") => ({ nextUrl: new URL(`https://example.invalid?barberId=${barberId}&date=${date}`) });
  await test("sin sesión: 401 sin consultar datos", async () => { caller = {}; queries = 0; assert.equal((await GET(request())).status, 401); assert.equal(queries, 0); });
  await test("profesional no ve ingresos de otro", async () => { caller = { userId: "otro", role: "barber", tenantId: "t" }; queries = 0; assert.equal((await GET(request())).status, 403); assert.equal(queries, 0); });
  await test("cliente no accede aunque conozca un id", async () => { caller = { userId: "pro", role: "client", tenantId: "t" }; assert.equal((await GET(request())).status, 403); });
  await test("otro negocio: profesional no encontrado dentro del tenant", async () => { caller = { userId: "admin", role: "admin", tenantId: "t" }; exists = false; assert.equal((await GET(request())).status, 403); exists = true; });
  await test("profesional puede consultar su propio resumen", async () => { caller = { userId: "pro", role: "barber", tenantId: "t" }; assert.equal((await GET(request())).status, 200); });
  await test("super admin requiere negocio concreto", async () => { caller = { userId: "sa", role: "super_admin", tenantId: "ALL" }; assert.equal((await GET(request())).status, 403); });
  await test("fecha inválida devuelve 400", async () => { caller = { userId: "admin", role: "admin", tenantId: "t" }; assert.equal((await GET(request("pro", "invalida"))).status, 400); });
  console.log(`${passed} pruebas correctas`);
}
main().catch(e => { console.error(e); process.exitCode = 1; });
