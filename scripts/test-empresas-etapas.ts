// Empresas, Etapas 1 a 4: rutas nuevas contra un servidor local, con sesiones reales y datos simulados en PRUEBAS.
// Requisitos: scripts/test-empresas-stock.ts ya corrido (empresas simuladas), migraciones 158-160 en pruebas y la app
// encendida en BASE_URL (por defecto http://localhost:3100).
// Uso: npx tsx scripts/test-empresas-etapas.ts
// SEGURIDAD: se niega a correr si .env.local no apunta a rebooking-pruebas o si BASE_URL no es local. No imprime llaves.
// Las campañas se prueban solo en modo simulado: si EMPRESAS_WHATSAPP_SEND=1 está en .env.local, ese paso se salta.
import { randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const PRUEBAS_REF = "ucwrdmwtlesayjxmlbve";
const SALON_PRUEBAS = "0235d97a-6658-4a1c-be69-8c1341ac50ce";
const BASE = process.env.BASE_URL || "http://localhost:3100";
const NO_AUTH = { auth: { persistSession: false, autoRefreshToken: false } };

const env: Record<string, string> = {};
for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const url = env.NEXT_PUBLIC_SUPABASE_URL || "";
if (!url.includes(PRUEBAS_REF) || !/^http:\/\/localhost:\d+$/.test(BASE)) {
  console.error("PARADO: esta prueba solo corre contra pruebas y un servidor local.");
  process.exit(2);
}
const admin = createClient(url, env.SUPABASE_SERVICE_ROLE_KEY, NO_AUTH);

let fails = 0;
let passed = 0;
const ok = (name: string, cond: boolean, detail?: unknown) => {
  if (cond) { passed++; console.log("ok", name); }
  else { fails++; console.log("FALLA", name, detail === undefined ? "" : JSON.stringify(detail).slice(0, 300)); }
};
async function must<T>(label: string, q: PromiseLike<{ data: T; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await q;
  if (error) throw new Error(`${label}: ${error.message}`);
  return data;
}

const createdUsers: string[] = [];
const createdCustomers: string[] = [];
const tag = randomUUID().slice(0, 6);

async function cookieFor(email: string, password: string): Promise<string> {
  const client = createClient(url, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, NO_AUTH);
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.session) throw new Error(`login: ${error?.message}`);
  return `sb-${PRUEBAS_REF}-auth-token=${encodeURIComponent(JSON.stringify(data.session))}`;
}
async function tempUser(prefix: string, tenantId: string, profileRole: string, companyRole?: string) {
  const email = `${prefix}-${randomUUID().slice(0, 8)}@example.invalid`;
  const password = randomBytes(24).toString("hex");
  const { data, error } = await admin.auth.admin.createUser({ email, email_confirm: true, password, user_metadata: { name: `Simulado ${prefix}` } });
  if (error || !data.user) throw new Error(`crear usuario: ${error?.message}`);
  createdUsers.push(data.user.id);
  await must("perfil", admin.from("profiles").upsert({ id: data.user.id, name: `Simulado ${prefix}`, email, role: profileRole, tenant_id: tenantId }));
  if (companyRole) await must("miembro", admin.from("company_members").insert({ tenant_id: tenantId, user_id: data.user.id, role_key: companyRole }));
  return { id: data.user.id, email, cookie: await cookieFor(email, password) };
}

type Res = { status: number; body: any; location: string | null };
async function call(method: string, path: string, cookie?: string, body?: unknown, headers: Record<string, string> = {}): Promise<Res> {
  const res = await fetch(`${BASE}${path}`, {
    method, redirect: "manual",
    headers: { ...headers, ...(cookie ? { cookie } : {}), ...(body !== undefined ? { "content-type": "application/json" } : {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let parsed: any = null;
  try { parsed = JSON.parse(text); } catch {}
  return { status: res.status, body: parsed, location: res.headers.get("location") };
}
const get = (p: string, c?: string) => call("GET", p, c);
const post = (p: string, c: string | undefined, b: unknown) => call("POST", p, c, b);
const patch = (p: string, c: string | undefined, b: unknown) => call("PATCH", p, c, b);
const cron = (p: string) => call("GET", p, undefined, undefined, env.CRON_SECRET ? { authorization: `Bearer ${env.CRON_SECRET}` } : {});

const ROUTES: [string, string, unknown?][] = [
  ["GET", "/api/empresa/usuarios"], ["POST", "/api/empresa/usuarios", {}], ["PATCH", `/api/empresa/usuarios/${randomUUID()}`, { active: false }],
  ["POST", "/api/empresa/importar", { kind: "productos", rows: [["a"], ["b"]] }],
  ["GET", "/api/empresa/config"], ["PATCH", "/api/empresa/config", { portalEnabled: true }],
  ["GET", "/api/empresa/cartera"], ["POST", "/api/empresa/cartera", { customerIds: [randomUUID()], sellerId: null }],
  ["GET", `/api/empresa/gestiones?customerId=${randomUUID()}`], ["POST", "/api/empresa/gestiones", {}],
  ["GET", "/api/empresa/reporte"], ["PATCH", `/api/empresa/clientes/${randomUUID()}`, { name: "x" }],
  ["GET", "/api/empresa/socios"], ["POST", "/api/empresa/socios", {}], ["PATCH", `/api/empresa/socios/${randomUUID()}`, { active: false }],
  ["GET", "/api/empresa/campanas"], ["POST", "/api/empresa/campanas", {}], ["POST", `/api/empresa/campanas/${randomUUID()}`, { action: "cancel" }],
];
const PORTAL: [string, string, unknown?][] = [["GET", "/api/socios/me"], ["GET", "/api/socios/catalogo"], ["GET", "/api/socios/pedidos"], ["POST", "/api/socios/pedidos", { items: [] }]];

async function loadCompany(letter: string) {
  const tenant = await must("empresa", admin.from("tenants").select("id").eq("slug", `empresa-sim-${letter}`).maybeSingle()) as { id: string } | null;
  if (!tenant) throw new Error("Faltan las empresas simuladas: corre primero scripts/test-empresas-stock.ts");
  const whs = await must("bodegas", admin.from("company_warehouses").select("id, name").eq("tenant_id", tenant.id)) as { id: string; name: string }[];
  return { tenantId: tenant.id, wh1: whs.find((w) => w.name === "Bodega 1")!.id };
}

async function main() {
  const a = await loadCompany("a");
  const b = await loadCompany("b");
  const owner = await tempUser("dueno", a.tenantId, "client", "owner");
  const seller = await tempUser("vendedor", a.tenantId, "client", "seller");
  const seller2 = await tempUser("vendedor2", a.tenantId, "client", "seller");
  const bodega = await tempUser("bodega", a.tenantId, "client", "warehouse");
  const ownerB = await tempUser("duenob", b.tenantId, "client", "owner");
  const salonAdmin = await tempUser("salon", SALON_PRUEBAS, "admin");
  // El portal se deja como estaba al final.
  const before = await must("config", admin.from("company_settings").select("*").eq("tenant_id", a.tenantId).maybeSingle()) as any;

  console.log("\n# Sin sesión y cruzado");
  for (const [m, p, body] of [...ROUTES, ...PORTAL]) {
    const r = await call(m, p, undefined, body);
    ok(`${m} ${p.replace(/[0-9a-f-]{36}/, ":id")} sin sesión`, r.status === 401, r.status);
  }
  for (const [m, p, body] of ROUTES) {
    const r = await call(m, p, salonAdmin.cookie, body);
    ok(`admin de salón: ${m} ${p.replace(/[0-9a-f-]{36}/, ":id")}`, r.status === 403, r.status);
  }
  for (const [m, p, body] of PORTAL) {
    const r = await call(m, p, owner.cookie, body);
    ok(`dueño en el portal: ${m} ${p}`, r.status === 403, r.status);
  }

  console.log("\n# Etapa 1: equipo");
  const pw = randomBytes(12).toString("hex");
  const newEmail = `nuevo-${tag}@example.invalid`;
  const created = await post("/api/empresa/usuarios", owner.cookie, { name: "Nuevo Simulado", email: newEmail, role: "seller", password: pw });
  ok("dueño crea un vendedor", created.status === 201, created);
  if (created.body?.member?.userId) createdUsers.push(created.body.member.userId);
  ok("el nuevo vendedor puede entrar", (await get("/api/empresa/me", await cookieFor(newEmail, pw))).body?.role === "seller");
  ok("correo repetido se rechaza", (await post("/api/empresa/usuarios", owner.cookie, { name: "X", email: newEmail, role: "seller", password: pw })).status === 409);
  ok("vendedor no crea usuarios", (await post("/api/empresa/usuarios", seller.cookie, { name: "X", email: `x-${tag}@example.invalid`, role: "owner", password: pw })).status === 403);
  ok("vendedor no ve correos del equipo", (await get("/api/empresa/usuarios", seller.cookie)).body?.members?.every((m: any) => m.email === undefined));
  ok("dueño no toca usuarios de otra empresa", (await patch(`/api/empresa/usuarios/${ownerB.id}`, owner.cookie, { active: false })).status === 404);
  ok("contraseña corta se rechaza", (await patch(`/api/empresa/usuarios/${seller2.id}`, owner.cookie, { password: "123" })).status === 400);

  console.log("\n# Etapa 1: importar");
  const sku = `IMP-${tag}`;
  const rows = [["Código", "Nombre", "Precio venta", "Costo", "Stock", "Bodega"], [sku, `Importado ${tag}`, "$5.000", "2500", "12", "Bodega 1"], ["", "", "", "", "", ""]];
  const dry = await post("/api/empresa/importar", owner.cookie, { kind: "productos", rows, dryRun: true });
  ok("revisión no escribe", dry.status === 200 && dry.body.create === 1 && dry.body.stockRows === 1, dry.body);
  ok("revisión no creó el producto", !(await must("p", admin.from("company_products").select("id").eq("tenant_id", a.tenantId).eq("sku", sku).maybeSingle())));
  const imp = await post("/api/empresa/importar", owner.cookie, { kind: "productos", rows, dryRun: false });
  ok("importa producto y stock inicial", imp.status === 200 && imp.body.created === 1 && imp.body.stockApplied === 1, imp.body);
  const prod = await must("p", admin.from("company_products").select("id, list_price").eq("tenant_id", a.tenantId).eq("sku", sku).single()) as any;
  ok("precio leído en formato chileno", Number(prod.list_price) === 5000);
  const imp2 = await post("/api/empresa/importar", owner.cookie, { kind: "productos", rows, dryRun: false });
  ok("reimportar no duplica ni suma stock", imp2.body.created === 0 && imp2.body.updated === 1 && imp2.body.stockApplied === 0, imp2.body);
  const st = await must("s", admin.from("company_warehouse_stock").select("quantity").eq("warehouse_id", a.wh1).eq("product_id", prod.id).single()) as any;
  ok("stock quedó en 12", st.quantity === 12, st);
  ok("vendedor no importa", (await post("/api/empresa/importar", seller.cookie, { kind: "productos", rows })).status === 403);
  const rut = `${Math.floor(Math.random() * 9e7) + 1e7}-K`;
  const cimp = await post("/api/empresa/importar", owner.cookie, { kind: "clientes", dryRun: false, rows: [["Razón social", "RUT", "Celular", "Vendedor"], [`Cliente importado ${tag}`, rut, "+56922222222", seller.email]] });
  ok("importa clientes con su vendedor", cimp.status === 200 && cimp.body.created === 1, cimp.body);
  const impCust = await must("c", admin.from("company_customers").select("id, assigned_seller_id").eq("tenant_id", a.tenantId).eq("tax_id", rut).single()) as any;
  createdCustomers.push(impCust.id);
  ok("el vendedor quedó asignado", impCust.assigned_seller_id === seller.id, impCust);

  console.log("\n# Etapa 2: cartera y cola");
  const mk = async (name: string, sellerId: string | null, extra: Record<string, unknown> = {}) => {
    const r = await post("/api/empresa/clientes", owner.cookie, { name, sellerId, ...extra });
    if (r.body?.customer?.id) createdCustomers.push(r.body.customer.id);
    return r.body?.customer?.id as string;
  };
  const c1 = await mk(`Cola uno ${tag}`, seller.id);
  const c2 = await mk(`Cola dos ${tag}`, seller.id);
  const cola = await get("/api/empresa/cartera", seller.cookie);
  ok("el vendedor ve su cola", cola.status === 200 && cola.body.queue.some((q: any) => q.customerId === c1), cola.body);
  const first = cola.body.current?.customerId;
  const other = cola.body.queue.find((q: any) => q.customerId !== first)?.customerId;
  ok("la cola trae los datos del cliente actual", !!cola.body.current?.customer?.name);
  const locked = await post("/api/empresa/gestiones", seller.cookie, { customerId: other, result: "sold" });
  ok("no puede saltarse al cliente que toca", locked.status === 409 && locked.body.code === "queue_locked", locked);
  ok("saltar exige motivo", (await post("/api/empresa/gestiones", seller.cookie, { customerId: first, result: "skipped" })).status === 400);
  ok("volver a llamar exige fecha", (await post("/api/empresa/gestiones", seller.cookie, { customerId: first, result: "callback" })).status === 400);
  const g1 = await post("/api/empresa/gestiones", seller.cookie, { customerId: first, result: "no_answer", notes: "simulado" });
  ok("anota el resultado del actual", g1.status === 201, g1);
  ok("la cola avanza", (await get("/api/empresa/cartera", seller.cookie)).body.current?.customerId !== first);
  ok("vendedor 2 no ve clientes de otra cartera", !(await get("/api/empresa/clientes", seller2.cookie)).body.customers.some((c: any) => c.id === c1));
  ok("vendedor 2 no gestiona clientes ajenos", (await post("/api/empresa/gestiones", seller2.cookie, { customerId: c1, result: "sold" })).status === 404);
  ok("vendedor 2 no toma pedidos de clientes ajenos", (await post("/api/empresa/pedidos", seller2.cookie, { customerId: c1, warehouseId: a.wh1, items: [{ productId: prod.id, quantity: 1 }] })).status === 400);
  ok("vendedor no reasigna clientes", (await post("/api/empresa/cartera", seller.cookie, { customerIds: [c1], sellerId: seller2.id })).status === 403);
  ok("vendedor no ve el historial de otro vendedor", (await get(`/api/empresa/gestiones?customerId=${c1}`, seller2.cookie)).status === 404);
  ok("bodega no tiene cola", (await get("/api/empresa/cartera", bodega.cookie)).status === 403);
  const resumen = await get("/api/empresa/cartera", owner.cookie);
  ok("el dueño ve el resumen por vendedor", resumen.status === 200 && resumen.body.sellers.some((s: any) => s.userId === seller.id && s.portfolio >= 2), resumen.body.sellers);
  ok("el dueño destraba: anota en cualquier cliente", (await post("/api/empresa/gestiones", owner.cookie, { customerId: other, result: "callback", callbackOn: new Date(Date.now() + 3 * 86400e3).toISOString().slice(0, 10) })).status === 201);
  ok("el dueño reasigna", (await post("/api/empresa/cartera", owner.cookie, { customerIds: [c2], sellerId: seller2.id })).body?.updated === 1);
  ok("no se asigna a alguien de otra empresa", (await post("/api/empresa/cartera", owner.cookie, { customerIds: [c2], sellerId: ownerB.id })).status === 400);
  const rep = await get("/api/empresa/reporte", owner.cookie);
  const fila = rep.body?.rows?.find((r: any) => r.sellerId === seller.id);
  ok("reporte: el vendedor gestionó al menos 1", rep.status === 200 && fila?.managed >= 1, rep.body);
  ok("vendedor no ve el reporte", (await get("/api/empresa/reporte", seller.cookie)).status === 403);
  ok("cron del reporte (simulado) responde", (await cron("/api/cron/empresas-reporte-semanal?dryRun=1")).status === 200);

  console.log("\n# Etapa 3: portal de distribuidores");
  ok("vendedor no cambia la configuración", (await patch("/api/empresa/config", seller.cookie, { portalEnabled: true })).status === 403);
  const dist = await mk(`Distribuidor ${tag}`, seller.id, { customerType: "distributor" });
  const noDist = await mk(`No distribuidor ${tag}`, null);
  const ppw = randomBytes(12).toString("hex");
  const pEmail = `socio-${tag}@example.invalid`;
  ok("solo distribuidores tienen portal", (await post("/api/empresa/socios", owner.cookie, { customerId: noDist, name: "X", email: `n-${tag}@example.invalid`, password: ppw })).status === 400);
  const socio = await post("/api/empresa/socios", owner.cookie, { customerId: dist, name: "Socio Simulado", email: pEmail, password: ppw });
  ok("dueño da acceso al portal", socio.status === 201, socio);
  if (socio.body?.partner?.userId) createdUsers.push(socio.body.partner.userId);
  const partner = await cookieFor(pEmail, ppw);
  await must("cerrar", admin.from("company_settings").upsert({ tenant_id: a.tenantId, portal_enabled: false }));
  ok("con el portal cerrado no entra", (await get("/api/socios/me", partner)).status === 403);
  ok("dueño abre el portal", (await patch("/api/empresa/config", owner.cookie, { portalEnabled: true, portalStockMode: "availability", portalWarehouseId: a.wh1 })).status === 200);
  const me = await get("/api/socios/me", partner);
  ok("el distribuidor entra", me.status === 200 && me.body.customerName?.includes(tag), me);
  const cat = await get("/api/socios/catalogo", partner);
  const item = cat.body?.products?.find((x: any) => x.id === prod.id);
  ok("ve el catálogo con disponibilidad", cat.status === 200 && item?.inStock === true, item);
  ok("no ve la cantidad en modo disponible", item && !("available" in item));
  ok("nunca ve el costo", cat.body?.products?.every((x: any) => !("cost" in x)));
  const pedido = await post("/api/socios/pedidos", partner, { items: [{ productId: prod.id, quantity: 2 }], notes: "simulado" });
  ok("el distribuidor hace un pedido", pedido.status === 201 && pedido.body.order.status === "draft", pedido);
  const ord = await must("o", admin.from("company_orders").select("source, customer_id, warehouse_id").eq("id", pedido.body.order.id).single()) as any;
  ok("pedido queda como portal, de su cliente y bodega", ord.source === "portal" && ord.customer_id === dist && ord.warehouse_id === a.wh1, ord);
  ok("su vendedor ve el pedido", (await get("/api/empresa/pedidos", seller.cookie)).body.orders.some((o: any) => o.id === pedido.body.order.id));
  ok("su vendedor abre el detalle", (await get(`/api/empresa/pedidos/${pedido.body.order.id}`, seller.cookie)).status === 200);
  ok("otro vendedor no lo ve", (await get(`/api/empresa/pedidos/${pedido.body.order.id}`, seller2.cookie)).status === 404);
  ok("el distribuidor ve sus pedidos", (await get("/api/socios/pedidos", partner)).body.orders.some((o: any) => o.id === pedido.body.order.id));
  ok("el distribuidor no entra al panel", (await get("/api/empresa/me", partner)).status === 403);
  ok("el panel lo manda al login", (await get("/empresa", partner)).location?.includes("/empresa/login") === true);
  ok("la página del portal carga", (await get("/socios", partner)).status === 200);
  ok("producto ajeno se rechaza", (await post("/api/socios/pedidos", partner, { items: [{ productId: randomUUID(), quantity: 1 }] })).status === 400);
  ok("dueño de otra empresa no ve los accesos", !(await get("/api/empresa/socios", ownerB.cookie)).body?.partners?.some((p: any) => p.email === pEmail));
  await patch(`/api/empresa/socios/${socio.body.partner.userId}`, owner.cookie, { active: false });
  ok("acceso desactivado queda fuera", (await get("/api/socios/me", partner)).status === 403);

  console.log("\n# Etapa 4: campañas (simulado)");
  ok("vendedor no programa campañas", (await post("/api/empresa/campanas", seller.cookie, {})).status === 403);
  ok("plantilla inválida se rechaza", (await post("/api/empresa/campanas", owner.cookie, { name: "X", templateName: "Con Espacios", audience: "all", scheduledAt: new Date().toISOString() })).status === 400);
  await patch(`/api/empresa/clientes/${c1}`, owner.cookie, { whatsappOptIn: true, phone: "+56933333333" });
  const camp = await post("/api/empresa/campanas", owner.cookie, { name: `Campaña ${tag}`, templateName: "promo_simulada", audience: "clients", scheduledAt: new Date().toISOString() });
  ok("dueño programa una campaña", camp.status === 201, camp);
  if (env.EMPRESAS_WHATSAPP_SEND === "1") {
    console.log("(se salta el cron de campañas: EMPRESAS_WHATSAPP_SEND=1 en .env.local)");
  } else {
    const run = await cron("/api/cron/empresas-campanas");
    ok("el cron procesa en modo simulado", run.status === 200 && run.body.sent === 0 && run.body.realSending === false, run.body);
    const sends = await must("envíos", admin.from("company_campaign_sends").select("customer_id, status").eq("campaign_id", camp.body.campaign.id)) as any[];
    ok("el cliente con permiso queda simulado", sends.some((s) => s.customer_id === c1 && s.status === "simulated"), sends);
    ok("quien no dio permiso no aparece", !sends.some((s) => s.customer_id === c2));
    const list = await get("/api/empresa/campanas", owner.cookie);
    ok("la campaña terminó", list.body.campaigns.find((c: any) => c.id === camp.body.campaign.id)?.status === "done");
    const again = await cron("/api/cron/empresas-campanas");
    const sends2 = await must("envíos", admin.from("company_campaign_sends").select("customer_id").eq("campaign_id", camp.body.campaign.id)) as any[];
    ok("una segunda pasada no repite", again.status === 200 && sends2.length === sends.length);
  }
  const camp2 = await post("/api/empresa/campanas", owner.cookie, { name: `Cancelar ${tag}`, templateName: "promo_simulada", audience: "all", scheduledAt: new Date(Date.now() + 86400e3).toISOString() });
  ok("se cancela una programada", (await post(`/api/empresa/campanas/${camp2.body.campaign.id}`, owner.cookie, { action: "cancel" })).body?.status === "cancelled");
  ok("otra empresa no la cancela", (await post(`/api/empresa/campanas/${camp2.body.campaign.id}`, ownerB.cookie, { action: "cancel" })).status === 409);

  console.log("\n# Respuestas de Felipe: tramos de precio, reintento y WhatsApp");
  const put = (p: string, c: string | undefined, b: unknown) => call("PUT", p, c, b);
  ok("vendedor no edita tramos", (await put("/api/empresa/precios", seller.cookie, { tiers: [] })).status === 403);
  const tiersBefore = (await get("/api/empresa/precios", owner.cookie)).body?.tiers || [];
  const sv = await put("/api/empresa/precios", owner.cookie, { tiers: [
    ...tiersBefore.filter((t: any) => t.active).map((t: any) => ({ id: t.id, name: t.name, discountPct: t.discountPct, minAmount: t.minAmount, maxAmount: t.maxAmount })),
    { name: `Mayorista prueba ${tag}`, discountPct: 10, minAmount: 6000000, maxAmount: 10000000 },
  ] });
  ok("dueño guarda tramos", sv.status === 200, sv);
  ok("tramo con máximo menor que el mínimo se rechaza", (await put("/api/empresa/precios", owner.cookie, { tiers: [{ name: "Malo", discountPct: 5, minAmount: 10, maxAmount: 1 }] })).status === 400);
  const precios = await get("/api/empresa/precios", owner.cookie);
  const tier = precios.body.tiers.find((t: any) => t.name === `Mayorista prueba ${tag}`);
  ok("el tramo nuevo aparece y el distribuidor sale en la lista", !!tier && precios.body.distributors.some((d: any) => d.customerId === dist), precios.body);
  ok("dueño asigna el tramo al distribuidor", (await patch(`/api/empresa/clientes/${dist}`, owner.cookie, { priceTierId: tier.id })).status === 200);
  ok("vendedor no asigna tramos", (await patch(`/api/empresa/clientes/${dist}`, seller.cookie, { priceTierId: null })).status === 403);
  const distB = (await post("/api/empresa/clientes", ownerB.cookie, { name: `Dist B ${tag}`, customerType: "distributor" })).body?.customer?.id;
  if (distB) createdCustomers.push(distB);
  ok("otra empresa no usa ese tramo", (await patch(`/api/empresa/clientes/${distB}`, ownerB.cookie, { priceTierId: tier.id })).status === 400);
  await patch(`/api/empresa/socios/${socio.body.partner.userId}`, owner.cookie, { active: true });
  const cat2 = await get("/api/socios/catalogo", partner);
  const it2 = cat2.body?.products?.find((x: any) => x.id === prod.id);
  ok("el portal muestra el precio con 10% menos", it2?.price === 4500 && it2?.listPrice === 5000 && cat2.body.tier?.discountPct === 10, it2);
  const pp = await post("/api/socios/pedidos", partner, { items: [{ productId: prod.id, quantity: 1 }] });
  const ppLine = await must("l", admin.from("company_order_items").select("unit_price").eq("order_id", pp.body.order.id).single()) as any;
  ok("el pedido del portal guarda el precio mayorista", Number(ppLine.unit_price) === 4500, ppLine);
  const op = await post("/api/empresa/pedidos", owner.cookie, { customerId: dist, warehouseId: a.wh1, items: [{ productId: prod.id, quantity: 1 }] });
  const opLine = await must("l", admin.from("company_order_items").select("unit_price").eq("order_id", op.body.order.id).single()) as any;
  ok("el pedido del vendedor también usa el tramo", Number(opLine.unit_price) === 4500, opLine);
  const c3 = await mk(`Reintento ${tag}`, seller2.id);
  const cola2 = await get("/api/empresa/cartera", seller2.cookie);
  const cur2 = cola2.body.current?.customerId;
  const fecha = new Date(Date.now() + 5 * 86400e3).toISOString().slice(0, 10);
  ok("no contestó con fecha elegida por el vendedor", (await post("/api/empresa/gestiones", seller2.cookie, { customerId: cur2, result: "no_answer", callbackOn: fecha })).status === 201);
  const act2 = await must("a", admin.from("company_customer_activities").select("callback_on").eq("customer_id", cur2).order("created_at", { ascending: false }).limit(1).single()) as any;
  ok("la fecha quedó guardada", act2.callback_on === fecha, act2);
  ok("ese cliente sale de la cola hasta la fecha", !(await get("/api/empresa/cartera", seller2.cookie)).body.queue.some((q: any) => q.customerId === cur2));
  ok("fecha de reintento inválida se rechaza", (await post("/api/empresa/gestiones", seller2.cookie, { customerId: (await get("/api/empresa/cartera", seller2.cookie)).body.current?.customerId ?? c3, result: "no_answer", callbackOn: "2020-01-01" })).status === 400);
  const ci = await post("/api/empresa/importar", owner.cookie, { kind: "clientes", dryRun: false, rows: [["Razón social", "Teléfono", "Acepta WhatsApp"], [`Con permiso ${tag}`, "+56944444444", "Sí"]] });
  const cust = await must("c", admin.from("company_customers").select("id, whatsapp_opt_in").eq("tenant_id", a.tenantId).eq("name", `Con permiso ${tag}`).single()) as any;
  createdCustomers.push(cust.id);
  ok("importar con 'Acepta WhatsApp' marca el permiso", ci.status === 200 && cust.whatsapp_opt_in === true, cust);
  // Los tramos de prueba quedan inactivos para no ensuciar Configuración.
  await admin.from("company_price_tiers").update({ active: false }).eq("id", tier.id);

  console.log("\n# Marcas y dashboard del dueño");
  ok("vendedor no ve el dashboard", (await get("/api/empresa/dashboard", seller.cookie)).status === 403);
  ok("bodega no ve el dashboard", (await get("/api/empresa/dashboard", bodega.cookie)).status === 403);
  ok("vendedor no crea marcas", (await post("/api/empresa/marcas", seller.cookie, { name: "X" })).status === 403);
  const mk1 = await post("/api/empresa/marcas", owner.cookie, { name: `Marca prueba ${tag}` });
  ok("dueño crea una marca", mk1.status === 201 && /^#[0-9A-F]{6}$/i.test(mk1.body.brand.color), mk1);
  ok("nombre repetido se rechaza", (await post("/api/empresa/marcas", owner.cookie, { name: `Marca prueba ${tag}` })).status === 409);
  const brandId = mk1.body.brand.id;
  ok("otra empresa no usa esa marca en sus productos", (await post("/api/empresa/productos", ownerB.cookie, { name: `Prod B ${tag}`, brandId })).status === 400);
  ok("otra empresa no edita la marca", (await patch(`/api/empresa/marcas/${brandId}`, ownerB.cookie, { name: "Robada" })).status === 404);
  ok("dueño asigna la marca al producto", (await patch(`/api/empresa/productos/${prod.id}`, owner.cookie, { brandId })).status === 200);
  ok("los productos traen su marca", (await get("/api/empresa/productos", seller.cookie)).body.products.find((p: any) => p.id === prod.id)?.brand_id === brandId);
  const dOrder = await post("/api/empresa/pedidos", owner.cookie, { customerId: c1, warehouseId: a.wh1, items: [{ productId: prod.id, quantity: 2 }] });
  for (const action of ["confirm", "prepare", "dispatch"]) await post(`/api/empresa/pedidos/${dOrder.body.order.id}`, owner.cookie, { action });
  const dsh = await get(`/api/empresa/dashboard?period=30d&brand=${brandId}`, owner.cookie);
  const row = dsh.body?.brands?.find((b: any) => b.id === brandId);
  ok("el despacho aparece en el dashboard de la marca", dsh.status === 200 && row?.revenue >= 10000 && row?.units >= 2, row);
  ok("margen con el costo del producto (5.000 − 2.500 por unidad)", row && row.margin >= 5000 && row.marginPct === 50, row);
  ok("filtrar una marca deja solo esa", dsh.body.brands.length === 1);
  ok("el gráfico trae 6 meses", dsh.body.monthly?.length === 6);
  ok("periodo inválido usa el mes", (await get("/api/empresa/dashboard?period=nada", owner.cookie)).body?.period === "month");
  const imp3 = await post("/api/empresa/importar", owner.cookie, { kind: "productos", dryRun: true, rows: [["Producto", "Marca", "SKU"], [`Con marca ${tag}`, `Marca nueva ${tag}`, `MB-${tag}`]] });
  ok("importar avisa las marcas nuevas", imp3.status === 200 && imp3.body.newBrands?.includes(`Marca nueva ${tag}`), imp3.body);
  ok("dueño desactiva la marca", (await patch(`/api/empresa/marcas/${brandId}`, owner.cookie, { active: false })).status === 200);
  await admin.from("company_products").update({ brand_id: null }).eq("id", prod.id);

  // Dejar la configuración como estaba.
  if (before) await admin.from("company_settings").update({ portal_enabled: before.portal_enabled, portal_stock_mode: before.portal_stock_mode, portal_warehouse_id: before.portal_warehouse_id }).eq("tenant_id", a.tenantId);
  else await admin.from("company_settings").delete().eq("tenant_id", a.tenantId);
}

async function cleanup() {
  // Los clientes simulados quedan inactivos (el historial de pedidos y gestiones los referencia).
  if (createdCustomers.length) await admin.from("company_customers").update({ active: false }).in("id", createdCustomers);
  for (const id of createdUsers) await admin.auth.admin.deleteUser(id);
}

main()
  .catch((e) => { fails++; console.error("ERROR:", e instanceof Error ? e.message : "desconocido"); })
  .finally(async () => {
    await cleanup();
    console.log(`\n${passed} ok, ${fails} fallas`);
    process.exit(fails ? 1 : 0);
  });
