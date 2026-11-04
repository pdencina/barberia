// Estado de los abonos recibidos. Uso: npx tsx scripts/test-abonos.ts
import assert from "node:assert/strict";
import { clasificarAbono, sePuedeDevolver, totalesAbonos } from "../src/lib/abonos";
let fails = 0;
const t = (n: string, f: () => void) => { try { f(); console.log("OK  " + n); } catch (e: any) { fails++; console.log("MAL " + n + ": " + e.message); } };
t("clasifica cada estado", () => { assert.equal(clasificarAbono("approved"), "recibido"); assert.equal(clasificarAbono("needs_refund"), "por_devolver"); assert.equal(clasificarAbono("refunded"), "devuelto"); for (const x of ["rejected:cc_rejected_other_reason", "pending:pending_waiting_payment", "cancelled:x", "", null, undefined]) assert.equal(clasificarAbono(x as any), "no_aprobado", String(x)); });
t("solo se devuelve lo recibido o por devolver", () => { assert.ok(sePuedeDevolver("approved")); assert.ok(sePuedeDevolver("needs_refund")); assert.ok(!sePuedeDevolver("refunded")); assert.ok(!sePuedeDevolver("rejected:x")); });
t("totales: suma por estado y cuenta los intentos no aprobados aparte", () => { assert.deepEqual(totalesAbonos([{ status: "approved", amount: 1000 }, { status: "approved", amount: 4000 }, { status: "needs_refund", amount: 2500 }, { status: "refunded", amount: 3000 }, { status: "rejected:x", amount: 9999 }, { status: "approved", amount: -5 }]), { recibido: 5000, por_devolver: 2500, devuelto: 3000, intentosNoAprobados: 1 }); });
process.exit(fails ? 1 : 0);
