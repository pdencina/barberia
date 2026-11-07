// Ocupación de profesionales. Uso: npx tsx scripts/test-ocupacion.ts
import assert from "node:assert/strict";
import { calcularOcupacion, totalGrupo, ordenarPros, pctOcup, nivelOcup, aMinutos, diasEntre, evaluarCierre } from "../src/lib/ocupacion";
let fails = 0;
const t = (n: string, f: () => void) => { try { f(); console.log("OK  " + n); } catch (e: any) { fails++; console.log("MAL " + n + ": " + e.message); } };

// 2026-11-02 es lunes (dow 1)
const pros = [{ id: "a", name: "Ana", modo: "comision" as const }, { id: "b", name: "Beto", modo: "arriendo" as const }];
const hor = (id: string) => ({ barber_id: id, day_of_week: 1, is_working: true, start_time: "10:00:00", end_time: "14:00:00", break_start: "12:00:00", break_end: "13:00:00" });
const base = { pros, horarios: [hor("a"), hor("b")], descansos: [], bloqueos: [], vacaciones: [], citas: [], ventas: [], desde: "2026-11-02", hasta: "2026-11-02" };
const cita = (id: string, ini: string, fin: string) => ({ barber_id: id, date: "2026-11-02", start_time: `2026-11-02T${ini}:00`, end_time: `2026-11-02T${fin}:00` });

t("minutos y días", () => { assert.equal(aMinutos("10:30:00"), 630); assert.equal(aMinutos(null), null); assert.deepEqual(diasEntre("2026-10-30", "2026-11-02"), ["2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02"]); });
t("turno 10 a 14 con colación 12 a 13 = 3 h disponibles", () => {
  const r = calcularOcupacion(base);
  assert.equal(r.pros[0].porMes["2026-11"].disp, 180); assert.equal(r.pros[0].porMes["2026-11"].ocup, 0); assert.equal(r.pros[0].porMes["2026-11"].dias, 1);
});
t("cita dentro del turno ocupa; la que cae en la colación no cuenta", () => {
  const r = calcularOcupacion({ ...base, citas: [cita("a", "10:00", "11:00"), cita("a", "12:15", "12:45")] });
  assert.equal(r.pros[0].porMes["2026-11"].ocup, 60); assert.equal(pctOcup(60, 180), 33);
});
t("bloqueos y descansos semanales reducen lo disponible; bloqueo de día completo lo anula", () => {
  const r = calcularOcupacion({ ...base, bloqueos: [{ barber_id: "a", date: "2026-11-02", start_time: "10:00:00", end_time: "11:00:00" }, { barber_id: "b", date: "2026-11-02", all_day: true }], descansos: [{ barber_id: "a", day_of_week: 1, start_time: "13:00:00", end_time: "13:30:00" }] });
  assert.equal(r.pros[0].porMes["2026-11"].disp, 180 - 60 - 30); assert.equal(r.pros[1].porMes["2026-11"].disp, 0);
});
t("vacaciones: ese día no cuenta", () => assert.equal(calcularOcupacion({ ...base, vacaciones: [{ barber_id: "a", start_date: "2026-11-01", end_date: "2026-11-05" }] }).pros[0].porMes["2026-11"].dias, 0));
t("ventas del período y total por grupo", () => {
  const r = calcularOcupacion({ ...base, citas: [cita("a", "10:00", "12:00"), cita("b", "10:00", "11:00")], ventas: [{ barber_id: "a", dia: "2026-11-02", total: 30000 }, { barber_id: "a", dia: "2026-10-20", total: 99 }] });
  assert.equal(r.pros[0].porMes["2026-11"].ventas, 30000);
  assert.deepEqual([totalGrupo(r, "comision", "2026-11").ocup, totalGrupo(r, "arriendo", "2026-11").ocup, totalGrupo(r, "todos", "2026-11").disp], [120 - 0, 60, 360]);
});
t("perfil por hora: se cuenta cada hora disponible y ocupada", () => {
  const r = calcularOcupacion({ ...base, citas: [cita("a", "10:00", "10:30")] });
  const h = r.horas["2026-11"].comision;
  assert.equal(h.disp[10], 60); assert.equal(h.ocup[10], 30); assert.equal(h.disp[12], 0); assert.equal(h.disp[13], 60);
});
t("niveles y orden", () => {
  assert.equal(nivelOcup(55), "alto"); assert.equal(nivelOcup(40), "medio"); assert.equal(nivelOcup(20), "bajo");
  const r = calcularOcupacion({ ...base, citas: [cita("b", "10:00", "12:00")] });
  assert.deepEqual(ordenarPros(r.pros, "2026-11", "ocupacion", false).map((p) => p.name), ["Beto", "Ana"]);
  assert.deepEqual(ordenarPros(r.pros, "2026-11", "muerto", false).map((p) => p.name), ["Ana", "Beto"]);
  assert.deepEqual(ordenarPros(r.pros, "2026-11", "nombre", true).map((p) => p.name), ["Ana", "Beto"]);
});
t("cierre de citas: confiable desde 70% o con pocas citas", () => {
  const mk = (c: number, n: number, a: number) => [...Array(c).fill("completed"), ...Array(n).fill("no_show"), ...Array(a).fill("scheduled"), "cancelled", "cancelled"];
  assert.deepEqual(evaluarCierre(mk(60, 2, 89)), { pct: 41, cerradas: 62, abiertas: 89, confiable: false });   // como Fluye en octubre
  assert.equal(evaluarCierre(mk(700, 10, 150)).confiable, true);                                                   // como Levels
  assert.equal(evaluarCierre(mk(2, 0, 8)).confiable, true);                                                        // muy pocas citas: no se juzga
  assert.equal(evaluarCierre([]).pct, 100);
});
process.exit(fails ? 1 : 0);
