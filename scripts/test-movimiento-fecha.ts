// Cambio de fecha de un movimiento. Uso: npx tsx scripts/test-movimiento-fecha.ts
import assert from "node:assert/strict";
import { errorFechaMovimiento, moverFecha } from "../src/lib/movimiento-fecha";
import { toChileDateStr } from "../src/lib/utils";
let fails = 0;
const t = (n: string, f: () => void) => { try { f(); console.log("OK  " + n); } catch (e: any) { fails++; console.log("MAL " + n + ": " + e.message); } };
const hora = (iso: string) => new Intl.DateTimeFormat("en-GB", { timeZone: "America/Santiago", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(new Date(iso));

t("valida: formato, existencia, futuro y antigüedad", () => {
  assert.equal(errorFechaMovimiento("2026-10-15", "2026-11-05"), null);
  assert.equal(errorFechaMovimiento("2026-11-05", "2026-11-05"), null);
  assert.ok(errorFechaMovimiento("2026-11-06", "2026-11-05")?.includes("futura"));
  assert.ok(errorFechaMovimiento("2026-02-30", "2026-11-05")?.includes("no válida"));
  assert.ok(errorFechaMovimiento("15/10/2026", "2026-11-05")?.includes("no válida"));
  assert.ok(errorFechaMovimiento("2015-01-01", "2026-11-05")?.includes("antigua"));
  assert.ok(errorFechaMovimiento(undefined, "2026-11-05")?.includes("no válida"));
});
t("mover fecha conserva la hora de Chile y cambia el día", () => {
  const original = "2026-11-04T22:30:15.000Z"; // 19:30:15 en Chile (UTC-3)
  const nuevo = moverFecha(original, "2026-10-20");
  assert.equal(toChileDateStr(nuevo), "2026-10-20");
  assert.equal(hora(nuevo), hora(original));
});
t("mover entre horario de verano e invierno sigue en el día elegido", () => {
  const nuevo = moverFecha("2026-11-04T22:59:00.000Z", "2026-06-10");
  assert.equal(toChileDateStr(nuevo), "2026-06-10");
});
t("un movimiento de madrugada no se pasa al día anterior", () => {
  const original = "2026-11-04T03:30:00.000Z"; // 00:30 Chile del día 4
  assert.equal(toChileDateStr(original), "2026-11-04");
  assert.equal(toChileDateStr(moverFecha(original, "2026-10-01")), "2026-10-01");
});
process.exit(fails ? 1 : 0);
