// Prueba del webhook de pago por QR del totem con Mercado Pago simulado. Usa la base de PRUEBAS. Ejecutar con las variables de entorno cargadas:
//   npx tsx scripts/test-kiosk-pay.ts <tenantId> <kioskPaymentId>
import { NextRequest } from "next/server";
import { firmarNegocio } from "../src/lib/deposit";
import { POST } from "../src/app/api/webhooks/kiosk-pay/route";

const [tenantId, kpId] = process.argv.slice(2);
let fallas = 0;
const ok = (c: boolean, m: string) => { console.log((c ? "OK    " : "FALLA ") + m); if (!c) fallas++; };

let pago: any = { status: "approved", transaction_amount: 13000, external_reference: `kp-${kpId}` };
const fetchReal = global.fetch;
(global as any).fetch = async (u: any, i?: any) => String(u).startsWith("https://api.mercadopago.com/v1/payments/")
  ? new Response(JSON.stringify(pago), { status: 200 }) : fetchReal(u, i);

const llamar = (firma: string | null, id = "999001") => POST(new NextRequest(`http://x/api/webhooks/kiosk-pay${firma === null ? "" : `?t=${tenantId}&s=${firma}`}`, { method: "POST", body: JSON.stringify({ type: "payment", data: { id } }) }));
const { createAdminSupabase } = require("../src/lib/supabase/server");
const sb = createAdminSupabase();
const estado = async () => (await sb.from("kiosk_payments").select("status, paid_amount, mp_payment_id").eq("id", kpId).single()).data;

(async () => {
  await llamar("firma-falsa"); ok((await estado()).status === "pending", "firma falsa: no marca nada");
  pago = { ...pago, status: "pending" }; await llamar(firmarNegocio(tenantId)); ok((await estado()).status === "pending", "pago pendiente: no marca nada");
  pago = { ...pago, status: "approved", transaction_amount: 5000 }; await llamar(firmarNegocio(tenantId)); ok((await estado()).status === "pending", "monto menor al cobrado: no marca nada");
  pago = { ...pago, transaction_amount: 13000, external_reference: "otra-cosa" }; await llamar(firmarNegocio(tenantId)); ok((await estado()).status === "pending", "referencia ajena: no marca nada");
  pago = { status: "approved", transaction_amount: 13000, external_reference: `kp-${kpId}` };
  await llamar(firmarNegocio(tenantId)); const e = await estado(); ok(e.status === "paid" && e.paid_amount === 13000 && e.mp_payment_id === "999001", "pago aprobado y firmado: queda pagado");
  const primero = (await sb.from("kiosk_payments").select("paid_at").eq("id", kpId).single()).data.paid_at;
  pago = { ...pago, transaction_amount: 99999 }; await llamar(firmarNegocio(tenantId), "999002");
  const segundo = await sb.from("kiosk_payments").select("paid_at, mp_payment_id, paid_amount").eq("id", kpId).single();
  ok(segundo.data.paid_at === primero && segundo.data.mp_payment_id === "999001" && segundo.data.paid_amount === 13000, "aviso repetido: no se procesa dos veces");
  console.log(fallas ? `\n${fallas} FALLA(S)` : "\nTodo OK"); process.exit(fallas ? 1 : 0);
})();
