// Pruebas de "Primer profesional disponible" y de los bloqueos del profesional. Ejecutar: npx tsx scripts/test-primer-disponible.ts
import { barbersWithFreeTime, firstDayWithSlots } from "../src/lib/first-available";
import { blockConflict } from "../src/lib/blocks";

let fails = 0;
const t = (name: string, ok: boolean, extra = "") => {
  if (!ok) fails++;
  console.log(`${ok ? "OK " : "MAL"} ${name}${extra ? " -> " + extra : ""}`);
};

const D = "2026-10-27";
const horas = (...h: string[]) => h.map((x) => `${D}T${x}:00`);
const pros = [{ id: "nico", name: "Nicolás" }, { id: "javi", name: "Javier" }, { id: "gabo", name: "Gabriel" }];
const ids = (l: Array<{ id: string }>) => l.map((x) => x.id).join(",");

(async () => {
  // ---------- primer profesional disponible ----------
  // El caso real: Nicolás tiene un bloqueo 10:00-20:00 (agenda sin horas libres) pero 0 citas.
  let r = await barbersWithFreeTime(pros, async (id) => (id === "nico" ? [] : horas("10:00", "11:00")));
  t("Nicolas con TODO el dia bloqueado por horas ya NO queda como disponible", ids(r) === "javi,gabo", ids(r));
  r = await barbersWithFreeTime(pros, async () => horas("10:00"));
  t("todos con horas libres: nadie se descarta y se conserva el orden", ids(r) === "nico,javi,gabo");
  r = await barbersWithFreeTime(pros, async () => []);
  t("si NADIE tiene horas (agenda cerrada): no se asigna a nadie", r.length === 0);
  r = await barbersWithFreeTime(pros, async (id) => (id === "javi" ? null : []));
  t("si no se pudo consultar a alguien (error tecnico) se deja en la lista; los demas sin horas se descartan", ids(r) === "javi", ids(r));
  r = await barbersWithFreeTime(pros, async (id) => { if (id === "gabo") throw new Error("red"); return []; });
  t("una excepcion al consultar tampoco rompe: ese profesional se conserva", ids(r) === "gabo", ids(r));

  // con una hora ya elegida por el cliente
  r = await barbersWithFreeTime(pros, async (id) => (id === "nico" ? horas("10:00", "10:30") : horas("11:00", "12:00")), `${D}T11:00:00`);
  t("con hora elegida (11:00): solo quien la tiene libre", ids(r) === "javi,gabo", ids(r));
  r = await barbersWithFreeTime(pros, async () => horas("11:00"), `${D}T11:00:30`);
  t("la hora se compara hasta el minuto", ids(r) === "nico,javi,gabo");
  r = await barbersWithFreeTime(pros, async () => horas("10:00"), `${D}T15:00:00`);
  t("hora elegida que nadie tiene libre: no se asigna a nadie", r.length === 0);

  // se consulta a cada profesional una sola vez, en paralelo
  const consultas: string[] = [];
  await barbersWithFreeTime(pros, async (id) => { consultas.push(id); return horas("10:00"); });
  t("se consulta una vez a cada profesional", consultas.length === 3 && new Set(consultas).size === 3);
  t("sin profesionales: lista vacia sin consultar", (await barbersWithFreeTime([], async () => horas("10:00"))).length === 0);

  // ---------- sin fecha elegida: alguno de los proximos dias ----------
  const dias = ["2026-10-26", "2026-10-27", "2026-10-28"];
  const horasDe = (d: string) => [`${d}T10:00:00`];
  let consultadas: string[] = [];
  let s = await firstDayWithSlots(dias, async (d) => { consultadas.push(d); return d === "2026-10-26" ? [] : horasDe(d); });
  t("sin fecha: si hoy no tiene horas pero manana si, queda disponible", s !== null && s.length === 1 && s[0].startsWith("2026-10-27"));
  t("sin fecha: deja de consultar apenas encuentra un dia con horas", consultadas.join() === "2026-10-26,2026-10-27", consultadas.join());
  s = await firstDayWithSlots(dias, async () => []);
  t("sin fecha: bloqueado/sin horas toda la ventana -> sin horas ([])", s !== null && s.length === 0);
  s = await firstDayWithSlots(dias, async (d) => (d === "2026-10-26" ? [] : null));
  t("sin fecha: si un dia no se pudo consultar -> desconocido (null), no se descarta", s === null);
  const ventana = await barbersWithFreeTime(pros, (id) => firstDayWithSlots(dias, async (d) => (id === "nico" ? [] : d === "2026-10-26" ? [] : horasDe(d))));
  t("sin fecha: Nicolas bloqueado toda la semana queda fuera; los demas con horas manana quedan", ids(ventana) === "javi,gabo", ids(ventana));

  // ---------- bloqueos frente a una reserva ----------
  const bloqueoDia = [{ all_day: true }];
  const bloqueo10a20 = [{ all_day: false, start_time: "10:00:00", end_time: "20:00:00" }];
  const bloqueoAlmuerzo = [{ all_day: false, start_time: "13:00", end_time: "14:00" }];
  const min = (h: number, m = 0) => h * 60 + m;
  t("dia completo bloqueado -> rechaza cualquier hora", blockConflict(bloqueoDia, 1, min(11), min(12)) === "day");
  t("bloqueo 10:00-20:00 -> rechaza las 11:00", blockConflict(bloqueo10a20, 1, min(11), min(11, 45)) === "time");
  t("bloqueo 10:00-20:00 -> rechaza una cita que empieza antes y termina dentro (09:30-10:15)", blockConflict(bloqueo10a20, 1, min(9, 30), min(10, 15)) === "time");
  t("bloqueo 10:00-20:00 -> rechaza una cita que empieza dentro y termina despues (19:30-20:15)", blockConflict(bloqueo10a20, 1, min(19, 30), min(20, 15)) === "time");
  t("bloqueo 10:00-20:00 -> deja pasar 09:00-09:45 (antes)", blockConflict(bloqueo10a20, 1, min(9), min(9, 45)) === null);
  t("bloqueo 10:00-20:00 -> deja pasar 20:00-20:45 (justo despues)", blockConflict(bloqueo10a20, 1, min(20), min(20, 45)) === null);
  t("bloqueo de almuerzo 13-14: rechaza 13:30 pero deja pasar 14:00 y 12:15-13:00", blockConflict(bloqueoAlmuerzo, 1, min(13, 30), min(14, 15)) === "time" && blockConflict(bloqueoAlmuerzo, 1, min(14), min(14, 45)) === null && blockConflict(bloqueoAlmuerzo, 1, min(12, 15), min(13)) === null);
  t("sin bloqueos: no hay conflicto", blockConflict([], 1, min(11), min(12)) === null && blockConflict(null, 1, min(11), min(12)) === null);
  t("bloqueo sin horas (dato incompleto) y no de dia completo: se ignora", blockConflict([{ all_day: false }], 1, min(11), min(12)) === null);
  t("un bloqueo de dia completo gana aunque haya otros", blockConflict([...bloqueoAlmuerzo, ...bloqueoDia], 1, min(8), min(9)) === "day");
  // cupos por bloque (solo kinesiologia): un bloqueo con 'spots' parcial NO cierra la hora (lo resuelve la capacidad)
  const parcial = [{ all_day: false, start_time: "10:00", end_time: "20:00", spots: 1 }];
  t("cupos por bloque: un bloqueo de 1 cupo con capacidad 3 no cierra la hora", blockConflict(parcial, 3, min(11), min(12)) === null);
  t("sin cupos por bloque (capacidad 1) ese mismo bloqueo SI cierra la hora", blockConflict(parcial, 1, min(11), min(12)) === "time");
  t("cupos por bloque: un bloqueo que ocupa todos los cupos SI cierra la hora", blockConflict([{ all_day: false, start_time: "10:00", end_time: "20:00", spots: 3 }], 3, min(11), min(12)) === "time");

  process.exit(fails ? 1 : 0);
})();
