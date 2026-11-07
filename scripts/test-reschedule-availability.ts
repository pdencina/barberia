import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import * as capacityFunctions from "../src/lib/capacity";
const Module = require("node:module"); const original = Module._load;
let cap = 1, vacation = false, windowClosed = false, scheduleError = false, appointmentError = false, blockError = false;
let blocks: any[] = [], calls: any[] = [], n = 0;
let appointmentRows: any[];
const own = { appointmentId: "own-appointment", tenantId: "tenant-a" };
const rows = [
  { id: "own-appointment", tenant_id: "tenant-a", start_time: "2030-11-12T10:00:00Z", end_time: "2030-11-12T11:00:00Z" },
  { id: "other-appointment", tenant_id: "tenant-a", start_time: "2030-11-12T12:00:00Z", end_time: "2030-11-12T13:00:00Z" },
];
const db = { from(table: string) {
  const eqs: any[] = [], neqs: any[] = []; let lower = 0, upper = Infinity;
  const q: any = {
    select() { return q; }, order() { return q; }, range(a: number, b: number) { lower = a; upper = b; return q; }, eq(k: string, v: any) { eqs.push([k, v]); return q; }, neq(k: string, v: any) { neqs.push([k, v]); return q; }, in() { return q; },
    async single() {
      if (table === "barber_schedule") return { data: { is_working: true, start_time: "09:00", end_time: "17:00" }, error: scheduleError ? { code: "offline" } : null };
      if (table === "profiles") return { data: { slot_duration: 15, tenant_id: "tenant-a" }, error: null };
      throw new Error(table);
    },
    then(resolve: any, reject: any) {
      calls.push({ table, eqs, neqs });
      if (table === "appointments") return Promise.resolve({ data: appointmentRows.filter((r: any) => eqs.every(([k, v]) => k === "barber_id" || k === "date" || r[k] === v) && neqs.every(([k, v]) => r[k] !== v)).slice(lower, upper + 1), error: appointmentError ? {} : null }).then(resolve, reject);
      if (table === "barber_blocks") return Promise.resolve({ data: blocks, error: blockError ? {} : null }).then(resolve, reject);
      throw new Error(table);
    },
  }; return q;
} };
Module._load = function (id: string, ...args: any[]) {
  if (id === "@/lib/supabase/server") return { createAdminSupabase: () => db };
  if (id === "@/lib/capacity") return { ...capacityFunctions, getSlotCapacity: async () => cap };
  if (id === "@/lib/vacations") return { isOnVacation: async () => vacation };
  if (id === "@/lib/booking-window") return { getWindowDays: async () => 14, isBeyondWindow: () => windowClosed };
  if (id === "@/lib/breaks") return { loadBreaks: async () => [], breaksForDay: () => [] };
  if (id === "@/lib/deposit-hold") return { limpiarHoldsVencidos: async () => {} };
  return original.call(this, id, ...args);
};
const { publicAvailability } = require("../src/lib/public-availability");
const { GET } = require("../src/app/api/public/availability/route");
Module._load = original;
const req = () => new NextRequest("https://example.test/api/public/availability?barberId=professional-a&date=2030-11-12&duration=60&excludeAppointmentId=own-appointment");
const includes = (d: any, time: string) => d.slots.includes(`2030-11-12T${time}:00`);
async function t(name: string, fn: () => unknown) { cap = 1; vacation = false; windowClosed = false; scheduleError = false; appointmentError = false; blockError = false; blocks = []; calls = []; appointmentRows = rows; await fn(); n++; console.log(`OK ${name}`); }
async function main() {
  await t("reserva pública sigue ocupando todas las citas e ignora exclusión del navegador", async () => { const d = await (await GET(req())).json(); assert.equal(includes(d, "10:00"), false); assert.equal(includes(d, "12:00"), false); assert.equal(includes(d, "09:00"), true); });
  await t("reagendar libera su propio horario, mantiene el resto y filtra negocio", async () => { const d = await (await publicAvailability(req(), own)).json(); assert.equal(includes(d, "10:00"), true); assert.equal(includes(d, "12:00"), false); const q = calls.find((c) => c.table === "appointments"); assert.deepEqual(q.neqs, [["id", own.appointmentId]]); assert.ok(q.eqs.some((f: any) => f[0] === "tenant_id" && f[1] === "tenant-a")); });
  await t("vacaciones no ofrecen horas", async () => { vacation = true; assert.deepEqual((await (await publicAvailability(req(), own)).json()).slots, []); });
  await t("ventana de reserva no permite fechas lejanas", async () => { windowClosed = true; assert.deepEqual((await (await publicAvailability(req(), own)).json()).slots, []); });
  await t("bloqueo del día sigue cerrando el horario", async () => { blocks = [{ all_day: true }]; assert.deepEqual((await (await publicAvailability(req(), own)).json()).slots, []); });
  await t("bloqueos parciales conservan su efecto", async () => { blocks = [{ all_day: false, start_time: "10:00", end_time: "11:00" }]; const d = await (await publicAvailability(req(), own)).json(); assert.equal(includes(d, "10:00"), false); assert.equal(includes(d, "11:00"), true); });
  await t("capacidad compartida permite cupo restante sin ignorar otras citas", async () => { cap = 2; const d = await (await publicAvailability(req(), own)).json(); assert.equal(includes(d, "12:00"), true); assert.equal(d.spots["2030-11-12T12:00:00"], 1); });
  await t("fallo al leer citas impide reagendar", async () => { appointmentError = true; assert.equal((await publicAvailability(req(), own)).status, 503); });
  await t("fallo de ambos esquemas de bloqueos impide reagendar", async () => { blockError = true; assert.equal((await publicAvailability(req(), own)).status, 503); });
  await t("más de mil citas se leen completas antes de ofrecer horas", async () => {
    appointmentRows = Array.from({ length: 1001 }, (_, i) => ({ id: `fixture-${i}`, tenant_id: "tenant-a", start_time: `2030-11-12T${i === 1000 ? "15:00" : "09:00"}:00Z`, end_time: `2030-11-12T${i === 1000 ? "16:00" : "10:00"}:00Z` }));
    const d = await (await publicAvailability(req(), own)).json(); assert.equal(includes(d, "15:00"), false); assert.equal(calls.filter((c) => c.table === "appointments").length, 2);
  });
  await t("fallo de horario no abre horas por defecto al reagendar", async () => { scheduleError = true; assert.equal((await publicAvailability(req(), own)).status, 503); });
  console.log(`${n} pruebas correctas`);
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
