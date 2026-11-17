// Prueba (sin red) de cómo se lee lo realmente pagado y la propina de Mercado Pago. Ejecutar: npx tsx scripts/test-mp-montos.ts
import { extraerMontosMp } from "../src/lib/totem-terminal";
let fallas = 0;
const ok = (c: boolean, m: string) => { console.log((c ? "OK    " : "FALLA ") + m); if (!c) fallas++; };

const orden = (pago: any) => ({ id: "ORD1", status: "processed", transactions: { payments: [pago] } });

let r = extraerMontosMp(orden({ id: "P1", status: "approved", amount: "18000.00", paid_amount: "18000.00", payment_method: { type: "debit_card" } }));
ok(r.solicitado === 18000 && r.pagado === 18000 && r.propina === 0, "sin propina: cobrado = pagado, propina 0");

r = extraerMontosMp(orden({ id: "P2", status: "approved", amount: "18000.00", paid_amount: "20000.00" }));
ok(r.solicitado === 18000 && r.pagado === 20000 && r.propina === 2000, "pagado mayor que cobrado: la diferencia ($2.000) es la propina");

r = extraerMontosMp(orden({ id: "P3", status: "approved", amount: 18000, tip_amount: 1500, paid_amount: 19500 }));
ok(r.propina === 1500, "campo explícito tip_amount: se usa ese valor");

r = extraerMontosMp(orden({ id: "P4", status: "approved", amount: "18000" }), { transaction_amount: 18000, transaction_details: { total_paid_amount: 21000 } });
ok(r.pagado === 21000 && r.propina === 3000, "el pago de Mercado Pago informa total_paid_amount mayor: propina $3.000");

r = extraerMontosMp(orden({ id: "P5", status: "approved", amount: "18000" }), { transaction_amount: 18000, additional_info: { tip: { amount: 2500 } } });
ok(r.propina === 2500, "propina anidada con nombre «tip»: se encuentra");

r = extraerMontosMp(orden({ id: "P6", status: "approved", amount: "18000", paid_amount: "90000" }));
ok(r.propina === 0, "diferencia absurda (más que el cobro): se ignora, no se inventa propina");

r = extraerMontosMp(orden({ id: "P7", status: "approved", amount: "18000", paid_amount: "17000" }));
ok(r.propina === 0, "pagado menor que cobrado: propina 0");

r = extraerMontosMp({ id: "X", transactions: { payments: [] } });
ok(r.solicitado === null && r.propina === 0, "orden sin pagos: no falla");
ok(!JSON.stringify(extraerMontosMp(orden({ id: "P8", status: "approved", amount: "1", payer: { email: "secreto@x.cl" } })).detalle).includes("secreto"), "el detalle guardado NO incluye datos del pagador");
console.log(fallas ? `\n${fallas} FALLA(S)` : "\nTodo OK"); process.exit(fallas ? 1 : 0);
