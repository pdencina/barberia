// Plan Lite. Uso: npx tsx scripts/test-plan-lite.ts
import assert from "node:assert/strict";
import { liteIncluye, esLite, LITE_PRECIO_NETO, LITE_PRECIO_TOTAL } from "../src/lib/plan-lite";
import { calculateSubscriptionAmount } from "../src/lib/subscription-pricing";
let fails = 0;
const t = (n: string, f: () => void) => { try { f(); console.log("OK  " + n); } catch (e: any) { fails++; console.log("MAL " + n + ": " + e.message); } };
t("el neto de 840 más IVA cobra exactamente $1.000", () => {
  const a = calculateSubscriptionAmount({ price_clp: LITE_PRECIO_NETO, included_professionals: 1, extra_professional_price_clp: 0, max_professionals: 1 }, 1, "monthly");
  assert.equal(a.monto, LITE_PRECIO_TOTAL);
});
t("Lite incluye agenda, billetera, horarios; bloquea el resto", () => {
  for (const ok of ["/dashboard/calendario", "/dashboard/calendario/semana", "/dashboard/mi-billetera", "/dashboard/barberos/123", "/dashboard/configuracion"]) assert.ok(liteIncluye(ok), ok);
  for (const no of ["/dashboard", "/dashboard/pos", "/dashboard/clientes", "/dashboard/finanzas", "/dashboard/ocupacion", "/dashboard/barberosx"]) assert.ok(!liteIncluye(no), no);
  assert.ok(esLite("lite") && !esLite("basic") && !esLite(null));
});
process.exit(fails ? 1 : 0);
