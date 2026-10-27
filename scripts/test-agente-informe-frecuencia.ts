// HECHO: ejercita el calendario real; reserva/cambio de configuración siguen simulados.
// No usa red, base, entorno, reloj real ni correo.
// Hora, fecha informada, ancla, día semanal y cambios de ciclo los decide Nico.
// IA2 se prueba con alternativas explícitas; ninguna queda elegida para producto.
import assert from "node:assert/strict";
import { enumerarFechasInforme } from "../src/lib/agente/calendario-informe";

type Frequency = "daily" | "every_3_days" | "weekly" | "custom";
interface Preference {
  profile: string;
  tenant: string;
  enabled: boolean;
  frequency: Frequency;
  effective: string;
  anchor?: string;
  weekday?: number;
  days?: number[];
  revision: number;
}
const DAY = 86_400_000; // unidad aritmética civil, NO duración de un día en Chile
const pad = (n: number) => String(n).padStart(2, "0");
function ordinal(value: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("Fecha inválida");
  const [year, month, day] = value.split("-").map(Number);
  // Solo fixtures >=1000: evita el tratamiento especial de años 0..99 de Date.UTC.
  const date = new Date(Date.UTC(year, month - 1, day));
  if (year < 1000 || year > 9999 || date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) throw new Error("Fecha inválida");
  return date.getTime() / DAY;
}
function civil(day: number): string {
  const date = new Date(day * DAY);
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}
const weekday = (day: number) => ((day + 4) % 7 + 7) % 7;
// Adaptador de los fixtures originales a la función REAL, no copia del algoritmo.
function calendarioSimulado(p: Preference, from: string, through: string): string[] {
  return enumerarFechasInforme({ enabled: p.enabled, frequency: p.frequency,
    effective_from: p.effective, anchor_date: p.anchor ?? null,
    custom_weekdays: p.days ?? [], weekly_weekday: p.weekday ?? null,
    send_local_time: null }, from, through);
}

const localFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: "America/Santiago", year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});
function local(instantMs: number): { date: string; time: string } {
  const parts = localFormat.formatToParts(new Date(instantMs));
  const get = (type: string) => parts.find(p => p.type === type)!.value;
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}` };
}
// SIMULADA: reserva en memoria para probar identidad por perfil/fecha civil.
// No equivale a reserva atómica persistente ni a confirmación del proveedor.
function reclamarSimulado(p: Preference, date: string, preparedRevision: number, accepted: Set<string>): boolean {
  if (preparedRevision !== p.revision || calendarioSimulado(p, date, date).length === 0) return false;
  const key = JSON.stringify([p.tenant, p.profile, date]);
  if (accepted.has(key)) return false;
  accepted.add(key);
  return true;
}
type Change = "preserve_anchor" | "reset_anchor";
function cambiarSimulado(p: Preference, effective: string, mode: Change): Preference {
  ordinal(effective);
  return { ...p, frequency: "every_3_days", effective, anchor: mode === "reset_anchor" ? effective : p.anchor, revision: p.revision + 1 };
}

let checks = 0;
function check(label: string, fn: () => void): void {
  fn(); checks++; console.log(`OK ${label}`);
}
const base: Preference = { tenant: "negocio-ficticio-a", profile: "admin-ficticio-a", enabled: true, frequency: "every_3_days", anchor: "2026-01-30", effective: "2026-01-30", revision: 1 };
const every = (p: Preference, start: string, end: string, expected: string[], label: string) => check(label, () => assert.deepEqual(calendarioSimulado(p, start, end), expected));

every(base, "2026-01-29", "2026-02-08", ["2026-01-30", "2026-02-02", "2026-02-05", "2026-02-08"], "cada 3 días cruza mes sin deriva");
every({ ...base, anchor: "2026-12-30", effective: "2026-12-30" }, "2026-12-29", "2027-01-08", ["2026-12-30", "2027-01-02", "2027-01-05", "2027-01-08"], "cada 3 días cruza año");
every({ ...base, anchor: "2028-02-27", effective: "2028-02-27" }, "2028-02-27", "2028-03-04", ["2028-02-27", "2028-03-01", "2028-03-04"], "cada 3 días atraviesa febrero bisiesto");
every({ ...base, anchor: "2026-02-27", effective: "2026-02-27" }, "2026-02-27", "2026-03-05", ["2026-02-27", "2026-03-02", "2026-03-05"], "cada 3 días atraviesa febrero normal");
every(base, "2026-01-20", "2026-01-29", [], "no hay ocurrencias anteriores al alta");
every(base, "2026-02-03", "2026-02-08", ["2026-02-05", "2026-02-08"], "retraso de evaluación conserva el ancla");
every({ ...base, enabled: false }, "2026-01-30", "2026-02-08", [], "apagado no tiene ocurrencias");
every({ ...base, frequency: "daily" }, "2026-01-30", "2026-02-02", ["2026-01-30", "2026-01-31", "2026-02-01", "2026-02-02"], "diario incluye bordes de mes");
every({ ...base, effective: "2026-02-01" }, "2026-01-30", "2026-02-05", ["2026-02-02", "2026-02-05"], "vigencia posterior al ancla no reinicia fase implícitamente");

for (let day = 0; day < 7; day++) {
  const p = { ...base, frequency: "weekly" as const, effective: "2026-01-01", weekday: day };
  check(`semanal día ${day}: solo el día explícito y separación de siete días`, () => {
    const dates = calendarioSimulado(p, "2026-01-01", "2026-02-01");
    assert.ok(dates.length >= 4);
    dates.forEach((date, i) => { assert.equal(weekday(ordinal(date)), day); if (i) assert.equal(ordinal(date) - ordinal(dates[i - 1]), 7); });
  });
}
every({ ...base, frequency: "weekly", weekday: 5, effective: "2026-12-25" }, "2026-12-25", "2027-01-08", ["2026-12-25", "2027-01-01", "2027-01-08"], "semanal viernes atraviesa año");
every({ ...base, frequency: "custom", days: [1, 3, 5], effective: "2026-10-26" }, "2026-10-26", "2026-11-02", ["2026-10-26", "2026-10-28", "2026-10-30", "2026-11-02"], "personalizada lunes miércoles viernes cruza mes");
every({ ...base, frequency: "custom", days: [0, 6], effective: "2026-10-26" }, "2026-10-26", "2026-11-02", ["2026-10-31", "2026-11-01"], "personalizada fin de semana con domingo cero");
every({ ...base, frequency: "custom", days: [6, 0], effective: "2026-10-26" }, "2026-10-26", "2026-11-02", ["2026-10-31", "2026-11-01"], "orden de selección no cambia orden de calendario");
check("personalizada todos los días equivale a diaria", () => assert.deepEqual(
  calendarioSimulado({ ...base, frequency: "custom", days: [0,1,2,3,4,5,6] }, "2026-01-30", "2026-03-02"),
  calendarioSimulado({ ...base, frequency: "daily" }, "2026-01-30", "2026-03-02"),
));
for (const days of [[], [1, 1], [-1], [7], [1.5]]) check(`rechaza días personalizados ${JSON.stringify(days)}`, () => assert.throws(() => calendarioSimulado({ ...base, frequency: "custom", days }, "2026-01-30", "2026-02-01")));
check("semanal sin día explícito se rechaza", () => assert.throws(() => calendarioSimulado({ ...base, frequency: "weekly" }, "2026-01-30", "2026-02-01")));
check("cada 3 días sin ancla se rechaza", () => assert.throws(() => calendarioSimulado({ ...base, anchor: undefined }, "2026-01-30", "2026-02-01")));
for (const date of ["2026-02-31", "2026-04-31", "2026-02-29", "2026-13-01", "2026-1-01"]) check(`fecha imposible ${date}`, () => assert.throws(() => ordinal(date)));
check("bisiesto válido", () => assert.equal(civil(ordinal("2028-02-29")), "2028-02-29"));

// HECHO del runtime Intl: fixtures de instantes UTC y sus fechas locales.
// No fija reglas legales futuras de horario de verano ni usa reloj real.
const midnightBefore = Date.UTC(2026, 9, 27, 2, 59);
const midnightAfter = Date.UTC(2026, 9, 27, 3, 0);
check("instante anterior a medianoche Chile", () => assert.deepEqual(local(midnightBefore), { date: "2026-10-26", time: "23:59" }));
check("instante a medianoche Chile cambia fecha civil", () => assert.deepEqual(local(midnightAfter), { date: "2026-10-27", time: "00:00" }));
const backBefore = Date.UTC(2026, 3, 5, 2, 59), backAfter = Date.UTC(2026, 3, 5, 3, 0);
check("retroceso Chile: 23:59", () => assert.deepEqual(local(backBefore), { date: "2026-04-04", time: "23:59" }));
check("retroceso Chile: vuelve a 23:00 del MISMO día", () => assert.deepEqual(local(backAfter), { date: "2026-04-04", time: "23:00" }));
const forwardBefore = Date.UTC(2026, 8, 6, 3, 59), forwardAfter = Date.UTC(2026, 8, 6, 4, 0);
check("adelanto Chile: último minuto día anterior", () => assert.deepEqual(local(forwardBefore), { date: "2026-09-05", time: "23:59" }));
check("adelanto Chile: salta a 01:00 sin perder fecha", () => assert.deepEqual(local(forwardAfter), { date: "2026-09-06", time: "01:00" }));
every({ ...base, anchor: "2026-04-02", effective: "2026-04-02" }, "2026-04-02", "2026-04-08", ["2026-04-02", "2026-04-05", "2026-04-08"], "cada 3 días atraviesa retroceso sin usar 72 horas");
every({ ...base, anchor: "2026-09-04", effective: "2026-09-04" }, "2026-09-04", "2026-09-10", ["2026-09-04", "2026-09-07", "2026-09-10"], "cada 3 días atraviesa adelanto sin usar 72 horas");
check("tres días civiles con retroceso duran 73 horas reales", () => assert.equal((Date.UTC(2026,3,5,4) - Date.UTC(2026,3,2,3)) / 3_600_000, 73));
check("tres días civiles con adelanto duran 71 horas reales", () => assert.equal((Date.UTC(2026,8,7,3) - Date.UTC(2026,8,4,4)) / 3_600_000, 71));

const daily = { ...base, frequency: "daily" as const };
check("retroceso: dos pasadas del reloj no duplican ocurrencia", () => {
  const accepted = new Set<string>();
  assert.equal(reclamarSimulado(daily, local(backBefore).date, 1, accepted), true);
  assert.equal(reclamarSimulado(daily, local(backAfter).date, 1, accepted), false);
});
check("medianoche: una ocurrencia por cada fecha", () => {
  const accepted = new Set<string>();
  assert.equal(reclamarSimulado(daily, local(midnightBefore).date, 1, accepted), true);
  assert.equal(reclamarSimulado(daily, local(midnightAfter).date, 1, accepted), true);
});
check("opt-out antes de reintento bloquea envío", () => assert.equal(reclamarSimulado({ ...daily, enabled: false }, "2026-10-26", 1, new Set()), false));
check("dos administradores tienen ocurrencias independientes", () => {
  const accepted = new Set<string>();
  assert.equal(reclamarSimulado(daily, "2026-10-26", 1, accepted), true);
  assert.equal(reclamarSimulado({ ...daily, profile: "admin-ficticio-b" }, "2026-10-26", 1, accepted), true);
  assert.equal(reclamarSimulado(daily, "2026-10-26", 1, accepted), false);
});
check("dos negocios no comparten reserva", () => {
  const accepted = new Set<string>();
  assert.equal(reclamarSimulado(daily, "2026-10-26", 1, accepted), true);
  assert.equal(reclamarSimulado({ ...daily, tenant: "negocio-ficticio-b" }, "2026-10-26", 1, accepted), true);
});

const old = { ...daily, anchor: "2026-10-25", effective: "2026-10-25" };
const preserve = cambiarSimulado(old, "2026-10-27", "preserve_anchor");
const reset = cambiarSimulado(old, "2026-10-27", "reset_anchor");
every(preserve, "2026-10-25", "2026-11-02", ["2026-10-28", "2026-10-31"], "IA2 alternativa conservar: cambio no retroactivo y ancla vieja");
every(reset, "2026-10-25", "2026-11-02", ["2026-10-27", "2026-10-30", "2026-11-02"], "IA2 alternativa reiniciar: nueva ancla explícita");
check("cambio de frecuencia invalida trabajo preparado con revisión vieja", () => assert.equal(reclamarSimulado(reset, "2026-10-27", 1, new Set()), false));
check("cambio de frecuencia acepta trabajo de revisión vigente", () => assert.equal(reclamarSimulado(reset, "2026-10-27", 2, new Set()), true));
check("cambio de frecuencia no duplica informe del día ya reservado", () => {
  const accepted = new Set<string>();
  assert.equal(reclamarSimulado(old, "2026-10-27", 1, accepted), true);
  assert.equal(reclamarSimulado(reset, "2026-10-27", 2, accepted), false);
});
check("IA2 alternativa diferir: conserva anterior hasta fecha de corte explícita", () => {
  const cutover = "2026-10-29";
  const next = cambiarSimulado(old, cutover, "reset_anchor");
  const before = calendarioSimulado(old, "2026-10-26", "2026-10-28");
  const after = calendarioSimulado(next, cutover, "2026-11-02");
  assert.deepEqual([...before, ...after], ["2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-11-01"]);
});
check("evaluación por bloques conserva todas las ocurrencias sin solapar", () => {
  const p = { ...base, anchor: "2026-01-01", effective: "2026-01-01" };
  const full = calendarioSimulado(p, "2026-01-01", "2027-01-31");
  const chunks = [...calendarioSimulado(p, "2026-01-01", "2026-06-30"), ...calendarioSimulado(p, "2026-07-01", "2027-01-31")];
  assert.deepEqual(chunks, full); assert.equal(new Set(chunks).size, full.length);
  for (let i = 1; i < full.length; i++) assert.equal(ordinal(full[i]) - ordinal(full[i - 1]), 3);
});
console.log(`RESULTADO: ${checks} casos, 0 fallas. Calendario REAL; reserva simulada; sin red/base/llaves/envíos. IA2 no decidida.`);
