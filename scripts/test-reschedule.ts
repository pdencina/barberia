import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { parseWallClock } from "../src/lib/wallclock";
const Module = require("node:module");
const original = Module._load;
const id = "11111111-1111-4111-8111-111111111111";
const base = { id, tenant_id: "tenant-a", barber_id: "professional-a", status: "confirmed", date: "2030-11-10", start_time: "2030-11-10T10:00:00+00:00", end_time: "2030-11-10T11:00:00+00:00", deposit_status: "paid", deposit_amount: 10000, deposit_payment_id: "simulated-payment" };
let horaTomada = false;
let appointment: any, settings: any, profile: any, loadError: any, saveError: any, raced: boolean, slotError: boolean, slots: string[], calls: any[], emails: number;
let passed = 0;
function reset() { horaTomada = false; appointment = { ...base }; settings = { client_change_hours: 24 }; profile = { id: base.barber_id }; loadError = null; saveError = null; raced = false; slotError = false; slots = ["2030-11-12T12:30:00"]; calls = []; emails = 0; }
const db = { from(table: string) {
  const filters: any[] = []; let update: any = null;
  const q: any = {
    select(fields: string) { calls.push({ table, select: fields }); return q; },
    eq(key: string, value: any) { filters.push([key, value]); return q; },
    update(value: any) { update = value; calls.push({ table, update, filters }); return q; },
    async maybeSingle() {
      if (table === "tenants") return { data: settings, error: null };
      if (table === "profiles") { calls.push({ table, filters }); return { data: profile, error: null }; }
      assert.equal(table, "appointments", "No debe acceder a pagos ni crear reservas nuevas");
      if (!update) return { data: appointment, error: loadError };
      if (saveError) return { data: null, error: saveError };
      if (raced) return { data: null, error: null };
      Object.assign(appointment, update); return { data: { id }, error: null };
    },
  };
  return q;
} };
Module._load = function (name: string, ...args: any[]) {
  if (name === "@/lib/supabase/server") return { createAdminSupabase: () => db };
  if (name === "@/lib/capacity") return { isSlotFull: async () => horaTomada };
  if (name === "@/lib/cancel-reasons") return { aHoraPared: () => parseWallClock("2030-11-01T10:00:00") };
  if (name === "@/lib/appointment-client-email") return { emailClientAboutAppointment: async () => { emails++; } };
  if (name === "@/lib/public-availability") return { publicAvailability: async (req: NextRequest, own: any) => {
    const q = new URL(req.url).searchParams;
    assert.equal(q.get("barberId"), base.barber_id); assert.equal(q.get("duration"), "60");
    assert.deepEqual(own, { appointmentId: id, tenantId: base.tenant_id });
    return new Response(JSON.stringify(slotError ? { error: "Disponibilidad no comprobada" } : { slots }), { status: slotError ? 503 : 200 });
  } };
  return original.call(this, name, ...args);
};
const { GET, POST } = require("../src/app/api/public/reschedule/route");
Module._load = original;
const request = (body: any) => new NextRequest("https://example.test/api/public/reschedule", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const valid = () => ({ appointmentId: id, date: "2030-11-12", start: slots[0], expectedStart: base.start_time });
const updates = () => calls.filter((c) => c.update);
async function test(name: string, fn: () => unknown) { reset(); await fn(); passed++; console.log(`OK ${name}`); }
async function main() {
  await test("cambiar cita con abono conserva ID, pago, servicios y total: solo escribe horario y recordatorio", async () => {
    const r = await POST(request({ ...valid(), tenantId: "other-tenant", barberId: "other-person", deposit_amount: 0, total: 0 }));
    assert.equal(r.status, 200); assert.equal(appointment.id, id);
    assert.equal(appointment.deposit_amount, 10000); assert.equal(appointment.deposit_status, "paid"); assert.equal(appointment.deposit_payment_id, "simulated-payment");
    assert.deepEqual(Object.keys(updates()[0].update).sort(), ["date", "end_time", "reminder_sent", "reminder_sent_at", "start_time"].sort());
    assert.equal(appointment.start_time, "2030-11-12T12:30:00Z"); assert.equal(appointment.end_time, "2030-11-12T13:30:00.000Z"); assert.equal(emails, 1);
    for (const pair of [["tenant_id", "tenant-a"], ["barber_id", "professional-a"], ["status", "confirmed"], ["start_time", base.start_time], ["end_time", base.end_time]]) assert.ok(updates()[0].filters.some((f: any) => JSON.stringify(f) === JSON.stringify(pair)));
  });
  await test("si otra persona tomo esa hora justo antes de guardar: 409 y la cita no cambia", async () => { horaTomada = true; const r = await POST(request(valid())); assert.equal(r.status, 409); assert.equal(updates().length, 0); assert.equal(appointment.start_time, base.start_time); });
  await test("cita sin abono también cambia sin crear cobros", async () => { appointment.deposit_amount = 0; appointment.deposit_status = null; assert.equal((await POST(request(valid()))).status, 200); assert.equal(appointment.deposit_amount, 0); });
  await test("GET devuelve versión y fecha sin datos personales ni de pago", async () => { const r = await GET(new NextRequest(`https://example.test/api/public/reschedule?id=${id}`)); assert.deepEqual(await r.json(), { start: base.start_time, date: base.date }); assert.equal(r.headers.get("Cache-Control"), "no-store"); });
  await test("GET consulta cupos excluyendo solo la propia cita validada", async () => { const r = await GET(new NextRequest(`https://example.test/api/public/reschedule?id=${id}&date=2030-11-12`)); assert.deepEqual((await r.json()).slots, slots); });
  await test("plazo del negocio vencido impide el cambio", async () => { appointment.start_time = "2030-11-02T09:00:00Z"; assert.equal((await POST(request(valid()))).status, 400); assert.equal(updates().length, 0); });
  await test("preferencia cero permite cambiar antes de comenzar", async () => { settings.client_change_hours = 0; appointment.start_time = "2030-11-01T10:30:00Z"; appointment.end_time = "2030-11-01T11:30:00Z"; assert.equal((await POST(request({ ...valid(), expectedStart: appointment.start_time }))).status, 200); });
  await test("sin migración del plazo aplica las dos horas predeterminadas", async () => { settings = null; appointment.start_time = "2030-11-01T11:00:00Z"; assert.equal((await POST(request(valid()))).status, 400); assert.equal(updates().length, 0); });
  await test("cita cancelada, completada o en atención no admite reagendar", async () => { for (const status of ["cancelled", "completed", "in_progress", "no_show"]) { appointment.status = status; assert.equal((await POST(request(valid()))).status, 400); } assert.equal(updates().length, 0); });
  await test("hora ocupada o bloqueo conserva la reserva anterior", async () => { slots = []; const r = await POST(request({ ...valid(), start: "2030-11-12T12:30:00" })); assert.equal(r.status, 409); assert.equal(appointment.start_time, base.start_time); assert.equal(updates().length, 0); });
  await test("fallo al comprobar disponibilidad no permite escribir", async () => { slotError = true; assert.equal((await POST(request(valid()))).status, 503); assert.equal(updates().length, 0); });
  await test("fecha imposible o hora con zona manipulada no se acepta", async () => { for (const value of [{ date: "2030-02-30" }, { start: "2030-11-12T99:99:00" }, { start: "2030-11-12T12:30:00Z" }, { start: "2030-11-13T12:30:00" }]) assert.ok((await POST(request({ ...valid(), ...value }))).status >= 400); assert.equal(updates().length, 0); });
  await test("otra modificación desde calendario obliga a recargar", async () => { assert.equal((await POST(request({ ...valid(), expectedStart: "anterior" }))).status, 409); assert.equal(updates().length, 0); });
  await test("cambio concurrente al guardar no envía correo ni sobrescribe", async () => { raced = true; assert.equal((await POST(request(valid()))).status, 409); assert.equal(emails, 0); assert.equal(appointment.start_time, base.start_time); });
  await test("error de base conserva la cita original y no anuncia éxito", async () => { saveError = { code: "conflict" }; assert.equal((await POST(request(valid()))).status, 409); assert.equal(appointment.start_time, base.start_time); assert.equal(emails, 0); });
  await test("profesional ajeno al negocio o inactivo queda bloqueado", async () => { profile = null; assert.equal((await POST(request(valid()))).status, 400); assert.equal(updates().length, 0); assert.ok(calls.some((c) => c.table === "profiles" && c.filters?.some((f: any) => f[0] === "tenant_id" && f[1] === base.tenant_id))); });
  await test("enlace inválido y cita desconocida no autorizan cambios", async () => { assert.equal((await POST(request({ ...valid(), appointmentId: "invalid" }))).status, 400); appointment = null; assert.equal((await POST(request(valid()))).status, 404); assert.equal(updates().length, 0); });
  await test("fallo de lectura no se confunde con cita válida", async () => { loadError = { code: "offline" }; assert.equal((await POST(request(valid()))).status, 503); assert.equal(updates().length, 0); });
  await test("no permite mover a fechas pasadas aunque disponibilidad las devuelva", async () => { slots = ["2030-10-31T12:30:00"]; assert.equal((await POST(request({ ...valid(), date: "2030-10-31" }))).status, 400); assert.equal(updates().length, 0); });
  await test("JSON inválido no produce escritura", async () => { const r = await POST(new NextRequest("https://example.test/api/public/reschedule", { method: "POST", body: "{" })); assert.equal(r.status, 400); assert.equal(updates().length, 0); });
  console.log(`${passed} pruebas correctas`);
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
