// Pruebas del mensaje de retencion: npx tsx scripts/test-retencion-mensaje.ts
import assert from "node:assert/strict";
import { buildRetentionWhatsApp, couponDiscountText } from "../src/lib/retention-message";

const url = "https://re-booking.cl/b/estudiolevels";
assert.equal(couponDiscountText({ code: "X", discount_type: "percentage", discount_value: 10 }), "10% de descuento");
assert.equal(couponDiscountText({ code: "X", discount_type: "fixed", discount_value: 5000 }), "$5.000 de descuento");
assert.equal(couponDiscountText(null), "");
// Sin mensaje propio: saludo con el primer nombre; sin nombre, "Hola!".
assert.ok(buildRetentionWhatsApp({ clientName: "Matías Pérez", bookingUrl: url }).startsWith("Hola Matías! Te extrañamos."));
assert.ok(buildRetentionWhatsApp({ clientName: "", bookingUrl: url }).startsWith("Hola! Te extrañamos."));
// Con mensaje propio y cupon: mensaje + cupon con su descuento + link.
const m = buildRetentionWhatsApp({ clientName: "Ana", message: "Te esperamos con un regalo", coupon: { code: "COLEGIO2026", discount_type: "percentage", discount_value: 15 }, bookingUrl: url });
assert.equal(m, `Te esperamos con un regalo\n\nTenemos un cupón para ti: COLEGIO2026 (15% de descuento)\n\nAgenda aquí: ${url}`);
console.log("OK: mensaje de retencion");
