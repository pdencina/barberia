// Qué incluye cada plan en el servidor. Uso: npx tsx scripts/test-plan-access.ts
import assert from "node:assert/strict";
import { reglaQueBloquea, liteBloqueaPagina, planIncluye } from "../src/lib/plan-access";
let fails = 0;
const t = (n: string, f: () => void) => { try { f(); console.log("OK  " + n); } catch (e: any) { fails++; console.log("MAL " + n + ": " + e.message); } };
const bloq = (plan: string, ruta: string, tipo: "pagina" | "api" = "pagina") => !!reglaQueBloquea(plan, ruta, tipo);

t("Basic y Lite no abren ventas, finanzas, mensajes masivos, cupones ni reportes avanzados", () => {
  for (const plan of ["basic", "lite"]) for (const r of ["/dashboard/pos", "/dashboard/standby", "/dashboard/finanzas", "/dashboard/whatsapp", "/dashboard/cupones", "/dashboard/ocupacion", "/dashboard/demanda", "/dashboard/boletas", "/dashboard/abonos"]) assert.ok(bloq(plan, r), `${plan} ${r}`);
  for (const plan of ["basic", "lite"]) for (const r of ["/api/pos/checkout", "/api/finanzas", "/api/whatsapp/contacts", "/api/cupones", "/api/ocupacion", "/api/boletas"]) assert.ok(bloq(plan, r, "api"), `${plan} ${r}`);
});
t("Starter sí tiene ventas, mensajes masivos, cupones y reportes, pero no caja, inventario, fidelización, facturas ni terminal", () => {
  for (const r of ["/dashboard/pos", "/dashboard/whatsapp", "/dashboard/cupones", "/dashboard/ocupacion", "/dashboard/standby"]) assert.ok(!bloq("starter", r), r);
  for (const r of ["/dashboard/caja", "/dashboard/inventario", "/dashboard/fidelidad", "/dashboard/facturas", "/dashboard/terminal-pos", "/dashboard/arriendo", "/dashboard/solicitud"]) assert.ok(bloq("starter", r), r);
  for (const r of ["/api/caja", "/api/invoices", "/api/loyalty/redeem", "/api/inventario/movements"]) assert.ok(bloq("starter", r, "api"), r);
});
t("Pro y Enterprise abren todo", () => { for (const plan of ["pro", "enterprise"]) for (const r of ["/dashboard/caja", "/dashboard/pos", "/dashboard/facturas", "/dashboard/fidelidad"]) assert.ok(!bloq(plan, r), `${plan} ${r}`); });
t("lo que todos los planes incluyen nunca se bloquea", () => {
  for (const plan of ["lite", "basic", "starter", "pro"]) for (const r of ["/dashboard/calendario", "/dashboard/mi-billetera", "/dashboard/configuracion/facturacion", "/api/appointments", "/api/oti/consulta", "/api/public/book", "/api/billing/summary"]) assert.ok(!bloq(plan, r, r.startsWith("/api") ? "api" : "pagina"), `${plan} ${r}`);
});
t("una ruta parecida no se confunde (prefijo exacto)", () => { assert.ok(!bloq("basic", "/dashboard/posx")); assert.ok(!bloq("basic", "/api/posters", "api")); });
t("plan desconocido o vacío no bloquea por error", () => { assert.ok(!bloq("raro", "/dashboard/pos")); assert.equal(reglaQueBloquea(null, "/dashboard/pos", "pagina"), null); });
t("Lite solo abre lo suyo", () => {
  assert.ok(liteBloqueaPagina("lite", "/dashboard/clientes")); assert.ok(liteBloqueaPagina("lite", "/dashboard"));
  assert.ok(!liteBloqueaPagina("lite", "/dashboard/calendario")); assert.ok(!liteBloqueaPagina("lite", "/dashboard/configuracion/facturacion")); assert.ok(!liteBloqueaPagina("lite", "/dashboard/onboarding"));
  assert.ok(!liteBloqueaPagina("basic", "/dashboard/clientes"));
});
t("accesos del equipo desde Starter", () => { assert.ok(!planIncluye("basic", "starter")); assert.ok(!planIncluye("lite", "starter")); assert.ok(planIncluye("starter", "starter")); assert.ok(planIncluye("enterprise", "starter")); });
process.exit(fails ? 1 : 0);
