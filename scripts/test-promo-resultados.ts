import { resumirPromos } from "../src/lib/promo-resultados";
let f = 0;
const ok = (c: boolean, t: string) => { if (!c) { f++; console.log("FALLA", t); } };
const r = resumirPromos(
  [{ id: "1", coupon_id: "p", status: "completed" }, { id: "2", coupon_id: "p", status: "scheduled" }, { id: "3", coupon_id: "p", status: "cancelled" }],
  [{ appointment_id: "1", service_id: "a", services: { name: "Corte " } }, { appointment_id: "1", service_id: "x", services: { name: "Cera" } }, { appointment_id: "2", service_id: "a", services: { name: "Corte " } }, { appointment_id: "3", service_id: "a", services: { name: "Corte " } }],
  [{ coupon_id: "p", total: "13600.00" }], { p: ["a"] }).p;
ok(r.reservas === 2 && r.atendidas === 1 && r.anuladas === 1, "citas");
ok(r.servicios.length === 1 && r.servicios[0].nombre === "Corte" && r.servicios[0].reservados === 2 && r.servicios[0].atendidos === 1, "solo servicios incluidos y sin anuladas");
ok(r.ventas === 1 && r.monto === 13600, "ventas");
ok(r.detalle.length === 3 && r.detalle.some((x) => x.estado === "cancelled") && r.detalle[0].servicios.includes("Corte"), "quién reservó");
console.log(f ? `${f} FALLAS` : "OK resultados de promoción");
process.exit(f ? 1 : 0);
