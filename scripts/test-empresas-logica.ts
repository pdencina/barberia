// Empresas, Etapas 1 a 4: pruebas de la lógica pura (cola de llamados, reporte semanal, lectura de Excel, campañas).
// No usa base de datos ni red. Ejecutar: npx tsx scripts/test-empresas-logica.ts
import { buildQueue, nextDueAt, weekRange, weekStartChile, weeklyReport, type Activity } from "../src/lib/empresas/cartera";
import { parseCustomers, parseNumber, parseProducts } from "../src/lib/empresas/import";
import { runDueCampaigns, type CampaignRepo, type SendStatus } from "../src/lib/empresas/campanas";
import { stockView } from "../src/lib/empresas/partner";
import { hashContactoWhatsApp } from "../src/lib/agente/whatsapp-meta";
import { buildDashboard, lastMonths, NO_BRAND, periodRanges } from "../src/lib/empresas/dashboard";
import { FELIPE_TIERS, previousMonthRange, priceWithTier, suggestTier, type PriceTier } from "../src/lib/empresas/precios";

let fails = 0;
const ok = (name: string, cond: boolean, extra?: unknown) => {
  if (!cond) fails++;
  console.log(`${cond ? "OK " : "MAL"} ${name}${cond || extra === undefined ? "" : " -> " + JSON.stringify(extra)}`);
};

const DAY = 86400e3;
const T0 = Date.parse("2026-11-02T15:00:00Z"); // lunes
const iso = (ms: number) => new Date(ms).toISOString();
const S = { contactEveryDays: 30, noAnswerRetryDays: 2, maxNoAnswerAttempts: 3 };
const act = (customerId: string, result: Activity["result"], at: number, extra: Partial<Activity> = {}): Activity =>
  ({ customerId, sellerId: "v1", result, createdAt: iso(at), ...extra });

console.log("# Cuándo toca cada cliente");
ok("nunca gestionado: toca desde que existe", nextDueAt([], S, iso(T0 - 5 * DAY)) === T0 - 5 * DAY);
ok("vendió: vuelve en 30 días", nextDueAt([act("a", "sold", T0)], S, iso(0)) === T0 + 30 * DAY);
ok("sin interés: vuelve en 30 días", nextDueAt([act("a", "not_interested", T0)], S, iso(0)) === T0 + 30 * DAY);
ok("saltado: vuelve mañana", nextDueAt([act("a", "skipped", T0)], S, iso(0)) === T0 + DAY);
ok("volver a llamar: en la fecha acordada", nextDueAt([act("a", "callback", T0, { callbackOn: "2026-11-10" })], S, iso(0)) === Date.parse("2026-11-10T04:00:00Z"));
ok("no contestó 1 vez: reintenta en 2 días", nextDueAt([act("a", "no_answer", T0)], S, iso(0)) === T0 + 2 * DAY);
const tres = [act("a", "no_answer", T0), act("a", "no_answer", T0 + 2 * DAY), act("a", "no_answer", T0 + 4 * DAY)];
ok("no contestó 3 veces: un ciclo desde el primer intento", nextDueAt(tres, S, iso(0)) === T0 + 30 * DAY);
ok("no contestó tras una venta: cuenta solo la racha", nextDueAt([act("a", "sold", T0 - 40 * DAY), act("a", "no_answer", T0)], S, iso(0)) === T0 + 2 * DAY);
ok("el orden de llegada no importa", nextDueAt([act("a", "sold", T0), act("a", "no_answer", T0 - DAY)], S, iso(0)) === T0 + 30 * DAY);

ok("no contestó con fecha elegida por el vendedor manda esa fecha", nextDueAt([act("a", "no_answer", T0, { callbackOn: "2026-11-20" })], S, iso(0)) === Date.parse("2026-11-20T04:00:00Z"));
ok("la fecha elegida gana aunque sea el 3er intento", nextDueAt([...tres.slice(0, 2), act("a", "no_answer", T0 + 4 * DAY, { callbackOn: "2026-11-07" })], S, iso(0)) === Date.parse("2026-11-07T04:00:00Z"));

console.log("\n# Cola obligatoria");
const customers = [
  { id: "a", name: "Ana", createdAt: iso(T0 - 10 * DAY), assignedSellerId: "v1" },
  { id: "b", name: "Beto", createdAt: iso(T0 - 20 * DAY), assignedSellerId: "v1" },
  { id: "c", name: "Caro", createdAt: iso(T0 - 30 * DAY), assignedSellerId: "v1" },
  { id: "d", name: "Dani", createdAt: iso(T0 - 30 * DAY), assignedSellerId: "v2" },
];
const q = buildQueue(customers.filter((c) => c.assignedSellerId === "v1"), [act("c", "sold", T0 - DAY)], S, T0);
ok("la cola trae solo a los que tocan", q.map((x) => x.customerId).join() === "b,a", q.map((x) => x.customerId));
ok("primero el más atrasado", q[0].customerId === "b");
ok("guarda el último resultado", buildQueue(customers, [act("a", "no_answer", T0 - 3 * DAY)], S, T0).find((x) => x.customerId === "a")?.lastResult === "no_answer");
ok("cola vacía si todo está al día", buildQueue([customers[2]], [act("c", "sold", T0)], S, T0).length === 0);

console.log("\n# Reporte semanal");
const ws = weekStartChile(T0);
ok("la semana parte el lunes", ws === "2026-11-02", ws);
ok("domingo en la noche sigue siendo la misma semana", weekStartChile(Date.parse("2026-11-09T02:00:00Z")) === "2026-11-02");
const range = weekRange(ws);
const acts: Activity[] = [
  act("a", "sold", T0 + DAY),
  act("b", "no_answer", T0 + DAY),
  act("b", "skipped", T0 + 2 * DAY, { skipReason: "x" } as any),
  act("c", "sold", T0 - 3 * DAY), // semana anterior: no cuenta
  { customerId: "d", sellerId: "v2", result: "sold", createdAt: iso(T0 + DAY) },
];
const [r1, r2] = weeklyReport(["v1", "v2"], customers, acts, range);
ok("v1 cartera 3", r1.portfolio === 3, r1);
ok("v1 gestionó 2 (a y b; saltar no cuenta)", r1.managed === 2, r1);
ok("v1 vendió 1", r1.sold === 1, r1);
ok("v1 sin atender 1 (c)", r1.unattended === 1, r1);
ok("v1 saltó 1", r1.skipped === 1, r1);
ok("v2 vendió 1 y nada sin atender", r2.sold === 1 && r2.unattended === 0, r2);

console.log("\n# Lectura de Excel");
ok("número chileno con puntos", parseNumber("$12.000") === 12000);
ok("decimal con coma", parseNumber("12.000,5") === 12000.5 && parseNumber("1,5") === 1.5);
ok("número simple", parseNumber("8000") === 8000 && parseNumber(8000) === 8000);
ok("vacío es null y texto es error", parseNumber("") === null && parseNumber("abc") === undefined);
const prods = parseProducts([
  ["Código", "Nombre del producto", "Precio venta ($)", "Stock", "Bodega"],
  ["A-1", "Cera mate", "$8.000", "40", "Central"],
  ["", "Pomada", "9000", "", ""],
  ["A-1", "Repetida", "1", "1", ""],
  ["B-2", "", "1", "1", ""],
  ["C-3", "Mal precio", "abc", "", ""],
  ["", "", "", "", ""],
]);
ok("reconoce títulos con variantes", prods.items.length === 2, prods);
ok("lee precio y stock", prods.items[0].listPrice === 8000 && prods.items[0].stock === 40 && prods.items[0].warehouse === "Central");
ok("avisa SKU repetido, sin nombre y número malo", prods.errors.length === 3, prods.errors);
ok("sin columna de nombre avisa", parseProducts([["sku", "precio"], ["x", "1"]]).missing.length === 1);
const clis = parseCustomers([
  ["Razón social", "RUT", "Celular", "Correo", "Tipo", "Vendedor"],
  ["Barbería Uno", "12.345.678-9", "+56 9 1111 1111", "UNO@MAIL.CL", "Distribuidor", "vendedor@x.cl"],
  ["Barbería Dos", "12345678-9", "", "no-es-correo", "", ""],
]);
ok("cliente: RUT sin puntos y tipo distribuidor", clis.items[0].taxId === "12345678-9" && clis.items[0].customerType === "distributor", clis.items[0]);
ok("cliente: correo en minúsculas", clis.items[0].email === "uno@mail.cl");
ok("cliente: RUT repetido (con o sin puntos) se avisa", clis.errors.length === 1 && clis.items.length === 1, clis.errors);

ok("Bsale: producto + variante", parseProducts([["Producto", "Variante", "SKU", "Precio Venta Bruto", "Precio Neto"], ["Shampoo", "500 ml", "S1", "11.900", "10.000"]]).items[0]?.name === "Shampoo 500 ml");
ok("Bsale: prefiere el precio bruto", parseProducts([["Producto", "Precio Neto", "Precio Venta Bruto"], ["X", "10.000", "11.900"]]).items[0]?.listPrice === 11900);
const optin = parseCustomers([["Nombre", "Teléfono", "Acepta WhatsApp"], ["Uno", "+56911111111", "Sí"], ["Dos", "+56922222222", "no"]]);
ok("permiso de WhatsApp desde el archivo", optin.items[0].whatsappOptIn === true && optin.items[1].whatsappOptIn === false && optin.items[0].phone === "+56911111111", optin.items);

console.log("\n# Tramos de precio (Felipe)");
const tiers: PriceTier[] = FELIPE_TIERS.map((t, i) => ({ ...t, id: `t${i}`, active: true }));
ok("5% menos sobre $10.000 = $9.500", priceWithTier(10000, 5) === 9500);
ok("7% de $8.990 se redondea a pesos", priceWithTier(8990, 7) === 8361);
ok("sin tramo = precio de lista", priceWithTier("12000", 0) === 12000 && priceWithTier(null, 5) === null);
ok("descuento fuera de rango se limita", priceWithTier(1000, 150) === 100 && priceWithTier(1000, -5) === 1000);
ok("$1,5 MM sugiere Mayorista 1", suggestTier(tiers, 1_500_000)?.name === "Mayorista 1");
ok("justo $2 MM sugiere el de más descuento (Mayorista 2)", suggestTier(tiers, 2_000_000)?.name === "Mayorista 2");
ok("$8 MM sugiere Mayorista 4", suggestTier(tiers, 8_000_000)?.name === "Mayorista 4");
ok("$5,5 MM cae en el hueco: sin sugerencia", suggestTier(tiers, 5_500_000) === null);
ok("$500 mil no llega a mayorista", suggestTier(tiers, 500_000) === null);
const pm = previousMonthRange(Date.parse("2026-11-10T15:00:00Z"));
ok("mes anterior = octubre en hora de Chile", pm.from === "2026-10-01T03:00:00.000Z" && pm.to === "2026-11-01T03:00:00.000Z", pm);
ok("en enero el mes anterior es diciembre", previousMonthRange(Date.parse("2026-01-05T15:00:00Z")).from === "2025-12-01T03:00:00.000Z");

console.log("\n# Dashboard por marca");
const NOW = Date.parse("2026-11-10T15:00:00Z");
const pmonth = periodRanges("month", NOW);
ok("mes: desde el 1 de noviembre (Chile)", new Date(pmonth.from).toISOString() === "2026-11-01T03:00:00.000Z", pmonth);
ok("mes anterior: el mismo tramo de octubre", new Date(pmonth.prevFrom).toISOString() === "2026-10-01T03:00:00.000Z" && pmonth.prevTo - pmonth.prevFrom === NOW - pmonth.from);
const p30 = periodRanges("30d", NOW);
ok("30 días y los 30 anteriores", p30.to - p30.from === 30 * DAY && p30.from - p30.prevFrom === 30 * DAY);
const pyear = periodRanges("year", NOW);
ok("año: desde el 1 de enero vs el mismo tramo del año pasado", new Date(pyear.from).toISOString() === "2026-01-01T03:00:00.000Z" && new Date(pyear.prevFrom).toISOString() === "2025-01-01T03:00:00.000Z");
const ms = lastMonths(NOW, 6);
ok("6 meses: de junio a noviembre", ms.length === 6 && ms[0].key === "2026-06" && ms[5].key === "2026-11", ms.map((x) => x.key));
const brandsD = [{ id: "b1", name: "Nishman", color: "#000000", active: true }, { id: "b2", name: "Viggo", color: "#111111", active: true }, { id: "b3", name: "Rovra", color: "#222222", active: true }];
const productsD = [
  { id: "p1", name: "Cera", sku: "C1", brandId: "b1", cost: 4000, listPrice: 9000, minStock: 5, active: true },
  { id: "p2", name: "Pomada", sku: "P1", brandId: "b2", cost: null, listPrice: 10000, minStock: 50, active: true },
  { id: "p3", name: "Sin marca", sku: null, brandId: null, cost: 1000, listPrice: 2000, minStock: 0, active: true },
];
const ord = (id: string, at: string, items: [string, number, number][], cust = "c1") => ({ id, customerId: cust, customerName: cust === "c1" ? "Barbería Uno" : "Barbería Dos", dispatchedAt: at, items: items.map(([productId, quantity, unitPrice]) => ({ productId, quantity, unitPrice })) });
const ordersD = [
  ord("o1", "2026-11-05T15:00:00Z", [["p1", 10, 9000], ["p2", 2, 10000]]),
  ord("o2", "2026-11-08T15:00:00Z", [["p1", 5, 8500]], "c2"),
  ord("o3", "2026-10-04T15:00:00Z", [["p1", 10, 9000]]), // mes anterior, dentro del tramo comparable
  ord("o4", "2026-10-25T15:00:00Z", [["p3", 3, 2000]]),  // mes anterior, fuera del tramo (después del día 10)
];
const dash = buildDashboard({ now: NOW, period: "month", brandFilter: null, brands: brandsD, products: productsD, orders: ordersD,
  stock: [{ productId: "p1", quantity: 20, reserved: 2 }, { productId: "p2", quantity: 10, reserved: 0 }], pending: [ord("o5", "2026-11-09T15:00:00Z", [["p1", 1, 9000]])] });
ok("ventas del mes = 90.000 + 20.000 + 42.500", dash.totals.revenue === 152500, dash.totals);
ok("margen solo con costo conocido: (90.000+42.500) − 15×4.000", dash.totals.margin === 72500 && dash.totals.marginPct === 54.7, dash.totals);
ok("unidades, pedidos y clientes", dash.totals.units === 17 && dash.totals.orders === 2 && dash.totals.customers === 2);
ok("variación vs el mismo tramo del mes anterior (90.000)", dash.totals.revenueChange === 69.4, dash.totals.revenueChange);
ok("stock valorizado a costo y bajo mínimo", dash.totals.stockAtCost === 80000 && dash.totals.lowStock === 1 && dash.totals.stockUnits === 30, dash.totals);
ok("pendiente por despachar", dash.totals.pendingValue === 9000 && dash.totals.pendingOrders === 1);
const nish = dash.brands.find((b) => b.id === "b1")!;
ok("Nishman primera, con su participación", dash.brands[0].id === "b1" && nish.revenue === 132500 && nish.share === 86.9, dash.brands);
ok("marca sin ventas igual aparece (Rovra en 0)", dash.brands.some((b) => b.id === "b3" && b.revenue === 0));
ok("sin costo: margen % de la marca es null", dash.brands.find((b) => b.id === "b2")!.marginPct === null);
ok("gráfico: octubre y noviembre por marca", dash.monthly.find((m) => m.key === "2026-11")!.values.b1 === 132500 && dash.monthly.find((m) => m.key === "2026-10")!.values[NO_BRAND] === 6000, dash.monthly);
ok("top producto y top cliente", dash.topProducts[0].id === "p1" && dash.topCustomers[0].id === "c1");
const solo = buildDashboard({ now: NOW, period: "month", brandFilter: "b2", brands: brandsD, products: productsD, orders: ordersD, stock: [], pending: [] });
ok("filtro por marca: solo Viggo", solo.totals.revenue === 20000 && solo.brands.length === 1 && solo.brands[0].id === "b2", solo.brands);

console.log("\n# Portal: qué ve del stock");
ok("modo disponible no muestra la cantidad", JSON.stringify(stockView(7, "availability")) === JSON.stringify({ inStock: true }));
ok("modo exacto muestra la cantidad", stockView(7, "exact").available === 7);
ok("faltante se muestra como agotado, nunca negativo", JSON.stringify(stockView(-3, "exact")) === JSON.stringify({ available: 0, inStock: false }));

console.log("\n# Campañas");
async function campaignRun(env: Record<string, string>, recipients: { id: string; phone: string | null; customerType: "client" | "distributor" }[], optedOut: string[] = []) {
  const done = new Map<string, SendStatus>();
  let sends = 0;
  let status = "scheduled";
  const repo: CampaignRepo = {
    dueCampaigns: async () => (status === "done" ? [] : [{ id: "k1", tenantId: "t1", templateName: "promo", templateLanguage: "es", audience: "clients" }]),
    claim: async () => { status = "sending"; return true; },
    recipients: async () => recipients,
    alreadyDone: async () => new Set(done.keys()),
    reserve: async (_c, id) => { if (done.has(id)) return false; done.set(id, "uncertain"); return true; },
    finish: async (_c, id, s) => { done.set(id, s); },
    optedOut: async (_t, hash) => optedOut.includes(hash),
    whatsappNumber: async () => "123456",
    markDone: async () => { status = "done"; },
  };
  const out = await runDueCampaigns({ repo, now: () => T0, env, send: async () => { sends++; return { estado: "aceptado", id: "wamid" }; } });
  return { out, done, sends, status, again: await runDueCampaigns({ repo, now: () => T0, env, send: async () => { sends++; return { estado: "aceptado", id: "x" }; } }) };
}
const people = [
  { id: "1", phone: "+56911111111", customerType: "client" as const },
  { id: "2", phone: null, customerType: "client" as const },
  { id: "3", phone: "+56933333333", customerType: "distributor" as const },
];
(async () => {
const sim = await campaignRun({}, people);
ok("sin EMPRESAS_WHATSAPP_SEND no se llama a Meta", sim.sends === 0 && sim.done.get("1") === "simulated", Array.from(sim.done));
ok("sin celular se omite", sim.done.get("2") === "skipped_no_phone");
ok("respeta la audiencia (distribuidor fuera)", !sim.done.has("3"));
ok("la campaña termina", sim.status === "done");
ok("una segunda ejecución no repite", sim.again.campaigns === 0 && sim.sends === 0);
const real = await campaignRun({ EMPRESAS_WHATSAPP_SEND: "1", AGENTE_CONTACT_HASH_SALT: "sal", WHATSAPP_ACCESS_TOKEN: "t", WHATSAPP_API_VERSION: "v21.0" }, people);
ok("con todo configurado se envía una vez por persona", real.sends === 1 && real.done.get("1") === "sent", Array.from(real.done));
const baja = await campaignRun({ EMPRESAS_WHATSAPP_SEND: "1", AGENTE_CONTACT_HASH_SALT: "sal", WHATSAPP_ACCESS_TOKEN: "t", WHATSAPP_API_VERSION: "v21.0" }, people, [hashContactoWhatsApp("sal", "t1", "56911111111")]);
ok("quien se dio de baja no recibe", baja.sends === 0 && baja.done.get("1") === "skipped_optout", Array.from(baja.done));

console.log(fails ? `\n${fails} prueba(s) MAL` : "\nTodo OK");
process.exit(fails ? 1 : 0);
})();
