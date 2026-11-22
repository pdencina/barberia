import assert from "node:assert";
import { construirChecklist, avance, desfasesDeHorario } from "../src/lib/configuracion-inicial";

const base: any = {
  hoy: "2026-11-21", tenant: { status: "active", trial_ends_at: null, slug: "x", booking_window_days: 14 },
  ajustes: { booking_enabled: true, deposit_enabled: false, mpConfigurado: false },
  profesionales: [{ id: "a", name: "Ana", role: "admin", active: true, also_attends_clients: true }],
  horarios: [], horarioNegocio: [], servicios: [{ id: "s", name: "Corte", active: true, internal_only: false }], asignaciones: [], vacaciones: [],
  datos: { name: "N", logo_url: null, phone: null, address: null },
  horasPro: [{ barber_id: "a", day_of_week: 1, is_working: true, start_time: "10:00:00", end_time: "20:00:00" }],
  horasNegocio: [{ day_of_week: 1, is_closed: false, open_time: "10:00", close_time: "18:00" }],
};
const get = (p: any[], id: string) => p.find((x) => x.id === id);
let p = construirChecklist(base);
assert.equal(get(p, "servicios").hecho, true);
assert.equal(get(p, "atiende").hecho, true);
assert.equal(get(p, "horario-profesional").problema, true, "desfase 20 vs 18");
assert.equal(get(p, "datos").hecho, false);
assert.equal(desfasesDeHorario(base, "a").length, 1);
p = construirChecklist({ ...base, servicios: [], profesionales: [], ajustes: { ...base.ajustes, deposit_enabled: true } });
assert.equal(get(p, "servicios").problema, true);
assert.equal(get(p, "atiende").problema, true);
assert.equal(get(p, "abono").problema, true);
const a = avance(p, ["probar"]);
assert.ok(a.esencialesPendientes.every((x) => x.id !== "probar"));
assert.ok(a.porcentaje >= 0 && a.porcentaje < 100);
console.log("ok configuracion-inicial");
