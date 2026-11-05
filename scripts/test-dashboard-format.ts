// Formatos de los gráficos del Dashboard. Uso: npx tsx scripts/test-dashboard-format.ts
import assert from "node:assert/strict";
import { montoCorto, marcasEje, resumenPeriodo, ventasPorMedio, intensidades } from "../src/lib/dashboard-format";
let fails = 0;
const t = (n: string, f: () => void) => { try { f(); console.log("OK  " + n); } catch (e: any) { fails++; console.log("MAL " + n + ": " + e.message); } };
t("montos cortos", () => {
  assert.equal(montoCorto(900), "$900");
  assert.equal(montoCorto(1500), "$1,5 mil");
  assert.equal(montoCorto(350000), "$350 mil");
  assert.equal(montoCorto(1250000), "$1,25 M");
  assert.equal(montoCorto(12000000), "$12 M");
  assert.equal(montoCorto(0), "$0");
  assert.equal(montoCorto(-2000), "-$2 mil");
});
t("marcas del eje redondas y cubren el máximo", () => {
  assert.deepEqual(marcasEje(0), [0, 1]);
  const m = marcasEje(870000);
  assert.equal(m[0], 0);
  assert.ok(m[m.length - 1] >= 870000);
  assert.ok(m.length <= 7);
  assert.deepEqual(marcasEje(100, 4), [0, 25, 50, 75, 100]);
});
t("resumen del período", () => {
  const r = resumenPeriodo([{ label: "a", date: "1", total: 0 }, { label: "b", date: "2", total: 100 }, { label: "c", date: "3", total: 300 }]);
  assert.equal(r.total, 400);
  assert.equal(r.promedio, 200);
  assert.equal(r.mejor?.label, "c");
  assert.equal(r.conVenta, 2);
});
t("medios de pago: el mixto se reparte por partes", () => {
  const r = ventasPorMedio(
    [{ id: "1", total: 10000, payment_method: "cash" }, { id: "2", total: 20000, payment_method: "mixed" }, { id: "3", total: 5000, payment_method: "debit_card" }],
    [{ transaction_id: "2", payment_method: "cash", amount: 5000 }, { transaction_id: "2", payment_method: "transfer", amount: 15000 }]
  );
  const m = Object.fromEntries(r.map((x) => [x.medio, x.total]));
  assert.deepEqual(m, { cash: 15000, transfer: 15000, debit_card: 5000 });
});
t("intensidad: un domingo se compara con los domingos y un día flojo sale rojo", () => {
  // 4 semanas: jueves ~400k, domingo ~50k; un jueves de 20k es muy lento, un domingo de 55k es normal
  const mk = (date: string, total: number) => ({ label: date, date, total });
  const data = [
    mk("2026-10-01", 400000), mk("2026-10-04", 50000), mk("2026-10-08", 420000), mk("2026-10-11", 52000),
    mk("2026-10-15", 380000), mk("2026-10-18", 48000), mk("2026-10-22", 20000), mk("2026-10-25", 55000), mk("2026-10-29", 900000),
  ];
  const r = intensidades(data, true);
  assert.equal(r[6].tono, "lento"); assert.equal(r[6].nivel, -3);
  assert.equal(r[7].tono, "normal");
  assert.equal(r[8].tono, "fuerte"); assert.equal(r[8].nivel, 3);
  assert.equal(r[0].tono, "normal");
});
t("intensidad: sin ventas queda neutro y la opacidad crece con la distancia", () => {
  const data = [100, 100, 100, 0, 60, 30, 150, 200].map((total, i) => ({ label: String(i), date: `2026-11-0${i + 1}`, total }));
  const r = intensidades(data, false);
  assert.equal(r[3].tono, "sin");
  assert.ok(r[5].opacidad > r[4].opacidad);
  assert.ok(r[7].opacidad > r[6].opacidad);
  assert.ok(r[6].tono === "fuerte" && r[4].tono === "lento");
});
process.exit(fails ? 1 : 0);
