// Pruebas del cupon SIN MONTO (solo codigo y texto). Ejecutar: npx tsx scripts/test-cupon-sin-monto.ts
import { couponKind, couponToDb, computeCouponDiscount } from "../src/lib/coupon";
import { buildRetentionWhatsApp, couponDiscountText } from "../src/lib/retention-message";
import { buildRetentionEmail } from "../src/lib/resend";

let fails = 0;
const t = (name: string, ok: boolean, extra = "") => {
  if (!ok) fails++;
  console.log(`${ok ? "OK " : "MAL"} ${name}${extra ? " -> " + extra : ""}`);
};

// ---------- tipos y guardado ----------
t("monto fijo $1000 es 'fixed_amount'", couponKind({ discount_type: "fixed_amount", discount_value: 1000 }) === "fixed_amount");
t("20% es 'percentage'", couponKind({ discount_type: "percentage", discount_value: 20 }) === "percentage");
t("valor 0 es 'none' (sin monto)", couponKind({ discount_type: "fixed_amount", discount_value: 0 }) === "none");
t("valor '0' como texto (la base devuelve numeric) es 'none'", couponKind({ discount_type: "fixed_amount", discount_value: "0" }) === "none");
t("valor nulo o negativo es 'none'", couponKind({ discount_value: null }) === "none" && couponKind({ discount_value: -5 }) === "none");
t("sin cupon es 'none'", couponKind(null) === "none" && couponKind(undefined) === "none");
t("guardar 'none' = monto fijo $0 (enum valido en la base)", JSON.stringify(couponToDb("none", "")) === JSON.stringify({ discount_type: "fixed_amount", discount_value: 0 }));
t("guardar 'none' ignora un valor escrito antes de cambiar de tipo", couponToDb("none", "5000").discount_value === 0);
t("guardar porcentaje", JSON.stringify(couponToDb("percentage", "15")) === JSON.stringify({ discount_type: "percentage", discount_value: 15 }));
t("guardar monto fijo", JSON.stringify(couponToDb("fixed_amount", "2500")) === JSON.stringify({ discount_type: "fixed_amount", discount_value: 2500 }));
t("lo guardado como 'none' se vuelve a leer como 'none'", couponKind(couponToDb("none", "")) === "none");

// ---------- descuento en el POS ----------
t("POS: sin monto no descuenta nada", computeCouponDiscount({ discount_type: "fixed_amount", discount_value: 0 }, 30000) === 0);
t("POS: 20% de 30.000 = 6.000", computeCouponDiscount({ discount_type: "percentage", discount_value: 20 }, 30000) === 6000);
t("POS: monto fijo $1.000", computeCouponDiscount({ discount_type: "fixed_amount", discount_value: 1000 }, 30000) === 1000);
t("POS: valor como texto '1000' (numeric de la base)", computeCouponDiscount({ discount_type: "fixed_amount", discount_value: "1000" }, 30000) === 1000);

// ---------- WhatsApp ----------
const url = "https://re-booking.cl/b/estudiolevels";
const sinMonto = { code: "CEJAS GRATIS", description: "Muestra este cupón en recepción y no pagas las cejas!", discount_type: "fixed_amount", discount_value: 0 };
const conMonto = { code: "CEJAS GRATIS", description: "Muestra este cupón en recepción y no pagas las cejas!", discount_type: "fixed_amount", discount_value: 1000 };
const w1 = buildRetentionWhatsApp({ clientName: "Tomas Munoz", coupon: sinMonto, bookingUrl: url });
const w2 = buildRetentionWhatsApp({ clientName: "Tomas Munoz", coupon: conMonto, bookingUrl: url });
const w3 = buildRetentionWhatsApp({ clientName: "Tomas Munoz", coupon: null, bookingUrl: url });
t("WhatsApp sin monto: trae el codigo y el texto", /CEJAS GRATIS/.test(w1) && /no pagas las cejas/.test(w1));
t("WhatsApp sin monto: NO dice '$0' ni 'de descuento'", !/\$0|de descuento/.test(w1), JSON.stringify(w1.split("\n").slice(-4)));
t("WhatsApp con monto: igual que antes (con el monto, sin repetir el texto)", /CEJAS GRATIS \(\$1\.000 de descuento\)/.test(w2) && !/no pagas las cejas/.test(w2));
t("WhatsApp sin cupon: no cambia", !/cupón/.test(w3) && /Agenda aquí/.test(w3));
t("WhatsApp: sigue incluyendo el link de reserva", w1.endsWith(`Agenda aquí: ${url}`));
t("texto de descuento: sin monto = vacio", couponDiscountText(sinMonto) === "" && couponDiscountText(conMonto) === "$1.000 de descuento");
t("sin monto y sin descripcion: solo el codigo", buildRetentionWhatsApp({ coupon: { code: "HOLA", description: "", discount_value: 0 }, bookingUrl: url }).includes("cupón para ti: HOLA\n\nAgenda aquí"));

// ---------- Correo ----------
const base = { to: "a@b.cl", clientName: "Tomas", message: "Te extrañamos! Vuelve pronto.", bookingUrl: url };
const e1 = buildRetentionEmail({ ...base, couponCode: "CEJAS GRATIS", couponDescription: sinMonto.description, discountType: "fixed_amount", discountValue: 0 }).html;
const e2 = buildRetentionEmail({ ...base, couponCode: "CEJAS GRATIS", couponDescription: sinMonto.description, discountType: "fixed_amount", discountValue: 1000 }).html;
const e3 = buildRetentionEmail({ ...base, couponCode: null, couponDescription: null, discountType: null, discountValue: null }).html;
t("Correo sin monto: muestra el codigo y el texto", /CEJAS GRATIS/.test(e1) && /no pagas las cejas/.test(e1));
t("Correo sin monto: NO dice '$0' ni 'de descuento'", !/\$0|de descuento/.test(e1));
t("Correo sin monto: titulo 'Cupón para ti' (no 'de descuento')", /Cupón para ti/.test(e1) && !/Cupón de descuento/.test(e1));
t("Correo con monto: igual que antes", /Cupón de descuento/.test(e2) && /\$1\.000 de descuento/.test(e2));
t("Correo sin cupon: no muestra caja de cupon", !/Cupón/.test(e3) && /Agendar ahora/.test(e3));
t("Correo: sigue el boton para agendar", /Agendar ahora/.test(e1));

// ---------- Mensaje de varias lineas (campo de texto grande de Retencion) ----------
const multi = buildRetentionEmail({ ...base, message: "Hola!\nDel 23 al 28 presenta el cupón.\n\n¡Te esperamos! <b>x</b>", couponCode: null, couponDescription: null, discountType: null, discountValue: null }).html;
t("Correo: los saltos de linea del mensaje pasan a <br>", /Hola!<br>Del 23 al 28 presenta el cupón\.<br><br>¡Te esperamos!/.test(multi));
t("Correo: el HTML escrito en el mensaje sigue escapado (no se ejecuta)", /&lt;b&gt;x&lt;\/b&gt;/.test(multi) && !/<b>x<\/b>/.test(multi));
const w4 = buildRetentionWhatsApp({ clientName: "Ana", message: "Linea 1\nLinea 2", coupon: null, bookingUrl: url });
t("WhatsApp: los saltos de linea del mensaje se conservan", w4.startsWith("Linea 1\nLinea 2\n\nAgenda aquí"));

process.exit(fails ? 1 : 0);
