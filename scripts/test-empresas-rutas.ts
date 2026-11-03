// Empresas: pruebas de las rutas y páginas contra un servidor corriendo, con sesiones reales y datos simulados.
// Requisitos: scripts/test-empresas-stock.ts ya corrido y la app encendida en BASE_URL (por defecto http://localhost:3100).
// Uso: npx tsx scripts/test-empresas-rutas.ts
// SEGURIDAD: se niega a correr si .env.local no apunta a rebooking-pruebas o si BASE_URL no es local. No imprime llaves.
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
  else { fails++; console.log("FALLA", name, detail ?? ""); }
};

async function must<T>(label: string, q: PromiseLike<{ data: T; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await q;
  if (error) throw new Error(`${label}: ${error.message}`);
  return data;
}

const createdUsers: string[] = [];
const createdProducts: string[] = [];

async function sessionCookie(userId: string, email: string): Promise<string> {
  const password = randomBytes(24).toString("hex");
  const { error } = await admin.auth.admin.updateUserById(userId, { password });
  if (error) throw new Error(`clave: ${error.message}`);
  const client = createClient(url, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, NO_AUTH);
  const { data, error: loginError } = await client.auth.signInWithPassword({ email, password });
  if (loginError || !data.session) throw new Error(`login: ${loginError?.message}`);
  return `sb-${PRUEBAS_REF}-auth-token=${encodeURIComponent(JSON.stringify(data.session))}`;
}

// Usuario temporal; se borra al final.
async function tempUser(prefix: string, tenantId: string, profileRole: string, companyRole?: string) {
  const email = `${prefix}-${randomUUID().slice(0, 8)}@example.invalid`;
  const { data, error } = await admin.auth.admin.createUser({ email, email_confirm: true, password: randomBytes(24).toString("hex"), user_metadata: { name: `Simulado ${prefix}` } });
  if (error || !data.user) throw new Error(`crear usuario: ${error?.message}`);
  createdUsers.push(data.user.id);
  await must("perfil", admin.from("profiles").upsert({ id: data.user.id, name: `Simulado ${prefix}`, email, role: profileRole, tenant_id: tenantId }));
  if (companyRole) await must("miembro", admin.from("company_members").insert({ tenant_id: tenantId, user_id: data.user.id, role_key: companyRole }));
  return { id: data.user.id, cookie: await sessionCookie(data.user.id, email) };
}

type Res = { status: number; body: any; location: string | null };
async function call(method: string, path: string, cookie?: string, body?: unknown): Promise<Res> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    redirect: "manual",
    headers: { ...(cookie ? { cookie } : {}), ...(body !== undefined ? { "content-type": "application/json" } : {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let parsed: any = null;
  try { parsed = JSON.parse(text); } catch {}
  return { status: res.status, body: parsed, location: res.headers.get("location") };
}
const get = (path: string, cookie?: string) => call("GET", path, cookie);
const post = (path: string, cookie: string | undefined, body: unknown) => call("POST", path, cookie, body);

const ROUTES: [string, string, unknown?][] = [
  ["GET", "/api/empresa/me"],
  ["GET", "/api/empresa/productos"],
  ["POST", "/api/empresa/productos", { name: "No debe existir" }],
  ["PATCH", `/api/empresa/productos/${randomUUID()}`, { name: "No" }],
  ["GET", "/api/empresa/bodegas"],
  ["POST", "/api/empresa/bodegas", { name: "No debe existir" }],
  ["GET", "/api/empresa/stock"],
  ["POST", "/api/empresa/stock/mover", {}],
  ["GET", "/api/empresa/movimientos"],
  ["GET", "/api/empresa/clientes"],
  ["POST", "/api/empresa/clientes", { name: "No debe existir" }],
  ["GET", "/api/empresa/pedidos"],
  ["POST", "/api/empresa/pedidos", {}],
  ["GET", `/api/empresa/pedidos/${randomUUID()}`],
  ["POST", `/api/empresa/pedidos/${randomUUID()}`, { action: "confirm" }],
  ["GET", "/api/empresa/conteos"],
  ["POST", "/api/empresa/conteos", {}],
  ["GET", `/api/empresa/conteos/${randomUUID()}`],
  ["POST", `/api/empresa/conteos/${randomUUID()}`, { action: "close" }],
];

async function loadCompany(letter: string) {
  const tenant = await must("empresa", admin.from("tenants").select("id").eq("slug", `empresa-sim-${letter}`).maybeSingle()) as { id: string } | null;
  if (!tenant) throw new Error("Faltan las empresas simuladas: corre primero scripts/test-empresas-stock.ts");
  const whs = await must("bodegas", admin.from("company_warehouses").select("id, name").eq("tenant_id", tenant.id)) as { id: string; name: string }[];
  return { tenantId: tenant.id, wh1: whs.find((w) => w.name === "Bodega 1")!.id, wh2: whs.find((w) => w.name === "Bodega 2")!.id };
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
  // Ser de una empresa sin estar en company_members no da nada, aunque el perfil diga admin.
  const noMember = await tempUser("sinmiembro", a.tenantId, "admin");

  console.log("\n# Sin sesión: todo rechazado");
  for (const [m, path, body] of ROUTES) {
    const r = await call(m, path, undefined, body);
    ok(`${m} ${path.replace(/[0-9a-f-]{36}/, ":id")} sin sesión`, r.status === 401, r.status);
  }
  const fake = await get("/api/empresa/me", `sb-${PRUEBAS_REF}-auth-token=${encodeURIComponent(JSON.stringify({ access_token: "falso", refresh_token: "falso", expires_at: Math.floor(Date.now() / 1000) + 3600, expires_in: 3600, token_type: "bearer", user: { id: owner.id } }))}`);
  ok("sesión falsificada rechazada", fake.status === 401, fake.status);

  console.log("\n# Cruzado: salón y usuario sin membresía");
  for (const [who, cookie] of [["admin de salón", salonAdmin.cookie], ["admin sin membresía", noMember.cookie]] as const) {
    for (const [m, path, body] of ROUTES) {
      const r = await call(m, path, cookie, body);
      ok(`${who}: ${m} ${path.replace(/[0-9a-f-]{36}/, ":id")}`, r.status === 403, r.status);
    }
  }

  console.log("\n# Páginas");
  ok("sin sesión /empresa va al login", (await get("/empresa")).location?.includes("/empresa/login") === true);
  ok("admin de salón en /empresa va al login", (await get("/empresa", salonAdmin.cookie)).location?.includes("/empresa/login") === true);
  ok("dueño entra a /empresa", (await get("/empresa", owner.cookie)).status === 200);
  ok("usuario de empresa en /dashboard va a /empresa", (await get("/dashboard", owner.cookie)).location?.endsWith("/empresa") === true);
  const salonDash = await get("/dashboard", salonAdmin.cookie);
  ok("admin de salón sigue entrando a /dashboard", salonDash.status === 200, { s: salonDash.status, l: salonDash.location });
  ok("el login de empresa se abre", (await get("/empresa/login")).status === 200);

  console.log("\n# Dueño");
  const me = await get("/api/empresa/me", owner.cookie);
  ok("me dice dueño", me.status === 200 && me.body.role === "owner", me);
  ok("me no entrega ids internos", !JSON.stringify(me.body).includes(a.tenantId));
  const sku = `SIM-${randomUUID().slice(0, 12)}`;
  const created = await post("/api/empresa/productos", owner.cookie, { name: "Simulado ruta", sku, listPrice: 1000, cost: 400, minStock: 2, tenantId: b.tenantId });
  ok("crea producto", created.status === 201, created);
  const product = created.body.product.id as string;
  createdProducts.push(product);
  const inA = await must("producto", admin.from("company_products").select("tenant_id").eq("id", product).single()) as { tenant_id: string };
  ok("el tenantId del navegador se ignora", inA.tenant_id === a.tenantId);
  ok("SKU repetido", (await post("/api/empresa/productos", owner.cookie, { name: "Otro", sku })).status === 409);
  ok("nombre vacío", (await post("/api/empresa/productos", owner.cookie, { name: "  " })).status === 400);
  ok("precio negativo", (await post("/api/empresa/productos", owner.cookie, { name: "X", listPrice: -1 })).status === 400);
  ok("dueño ve costos", (await get("/api/empresa/productos", owner.cookie)).body.products.some((p: any) => p.id === product && p.cost === 400));
  const moved = await post("/api/empresa/stock/mover", owner.cookie, { type: "in", productId: product, warehouseId: a.wh1, quantity: 10, idempotencyKey: randomUUID() });
  ok("entrada", moved.status === 200, moved);
  const key = randomUUID();
  await post("/api/empresa/stock/mover", owner.cookie, { type: "adjust", productId: product, warehouseId: a.wh1, quantity: 5, reason: "Simulado", idempotencyKey: key });
  const retry = await post("/api/empresa/stock/mover", owner.cookie, { type: "adjust", productId: product, warehouseId: a.wh1, quantity: 5, reason: "Simulado", idempotencyKey: key });
  ok("reintento no duplica", retry.body.replayed === true);
  const line = async (cookie: string) => (await get("/api/empresa/stock", cookie)).body.stock.find((s: any) => s.productId === product && s.warehouseId === a.wh1);
  const l1 = await line(owner.cookie);
  ok("físico, reservado y disponible", l1?.quantity === 15 && l1?.reserved === 0 && l1?.available === 15, l1);
  ok("cantidad decimal", (await post("/api/empresa/stock/mover", owner.cookie, { type: "in", productId: product, warehouseId: a.wh1, quantity: 1.5, idempotencyKey: randomUUID() })).status === 400);
  ok("sin llave", (await post("/api/empresa/stock/mover", owner.cookie, { type: "in", productId: product, warehouseId: a.wh1, quantity: 1 })).status === 400);
  const short = await post("/api/empresa/stock/mover", owner.cookie, { type: "out", productId: product, warehouseId: a.wh1, quantity: 999, idempotencyKey: randomUUID() });
  ok("sin stock da mensaje claro", short.status === 409 && short.body.error.includes("stock"), short);
  ok("JSON malo no rompe", (await fetch(`${BASE}/api/empresa/clientes`, { method: "POST", headers: { cookie: owner.cookie, "content-type": "application/json" }, body: "{malo" })).status === 400);

  console.log("\n# Cruzado entre empresas");
  ok("B no ve el producto de A", !(await get("/api/empresa/productos", ownerB.cookie)).body.products.some((p: any) => p.id === product));
  ok("B no ve el stock de A", !(await get("/api/empresa/stock", ownerB.cookie)).body.stock.some((s: any) => s.productId === product));
  ok("B no edita el producto de A", (await call("PATCH", `/api/empresa/productos/${product}`, ownerB.cookie, { name: "Robado" })).status === 404);
  ok("B no mueve con producto de A", (await post("/api/empresa/stock/mover", ownerB.cookie, { type: "in", productId: product, warehouseId: b.wh1, quantity: 1, idempotencyKey: randomUUID() })).status === 404);
  ok("B no usa bodega de A", (await post("/api/empresa/conteos", ownerB.cookie, { warehouseId: a.wh1 })).status === 404);

  console.log("\n# Vendedor");
  const cust = await post("/api/empresa/clientes", seller.cookie, { name: `Cliente simulado ${randomUUID().slice(0, 8)}` });
  ok("vendedor crea cliente", cust.status === 201, cust);
  const customerId = cust.body.customer.id as string;
  ok("vendedor no ve costos", (await get("/api/empresa/productos", seller.cookie)).body.products.every((p: any) => !("cost" in p)));
  ok("vendedor no crea productos", (await post("/api/empresa/productos", seller.cookie, { name: "No" })).status === 403);
  ok("vendedor no mueve stock", (await post("/api/empresa/stock/mover", seller.cookie, { type: "in", productId: product, warehouseId: a.wh1, quantity: 1, idempotencyKey: randomUUID() })).status === 403);
  ok("vendedor no abre conteos", (await post("/api/empresa/conteos", seller.cookie, { warehouseId: a.wh2 })).status === 403);
  const items = [{ productId: product, quantity: 4, unitPrice: 1 }];
  const o = await post("/api/empresa/pedidos", seller.cookie, { customerId, warehouseId: a.wh1, items });
  ok("vendedor crea pedido", o.status === 201, o);
  const orderId = o.body.order.id as string;
  const detail = await get(`/api/empresa/pedidos/${orderId}`, seller.cookie);
  ok("el precio sale del catálogo, no del navegador", Number(detail.body.order.items[0].unit_price) === 1000, detail.body);
  const custB = await post("/api/empresa/clientes", ownerB.cookie, { name: "Cliente simulado B" });
  ok("pedido con cliente de otra empresa", (await post("/api/empresa/pedidos", seller.cookie, { customerId: custB.body.customer.id, warehouseId: a.wh1, items })).status === 400);
  ok("pedido con bodega de otra empresa", (await post("/api/empresa/pedidos", seller.cookie, { customerId, warehouseId: b.wh1, items })).status === 400);
  ok("pedido con producto repetido", (await post("/api/empresa/pedidos", seller.cookie, { customerId, warehouseId: a.wh1, items: [...items, ...items] })).status === 400);
  ok("otro vendedor no ve el pedido", (await get(`/api/empresa/pedidos/${orderId}`, seller2.cookie)).status === 404);
  ok("otro vendedor no lo confirma", (await post(`/api/empresa/pedidos/${orderId}`, seller2.cookie, { action: "confirm" })).status === 404);
  ok("otro vendedor no lo lista", !(await get("/api/empresa/pedidos", seller2.cookie)).body.orders.some((x: any) => x.id === orderId));
  ok("B no ve el pedido", (await get(`/api/empresa/pedidos/${orderId}`, ownerB.cookie)).status === 404);
  ok("bodega no ve borradores", (await get(`/api/empresa/pedidos/${orderId}`, bodega.cookie)).status === 404);
  ok("acción inválida", (await post(`/api/empresa/pedidos/${orderId}`, seller.cookie, { action: "__proto__" })).status === 400);
  ok("vendedor confirma", (await post(`/api/empresa/pedidos/${orderId}`, seller.cookie, { action: "confirm" })).body.status === "confirmed");
  const l2 = await line(seller.cookie);
  ok("queda reservado", l2?.reserved === 4 && l2?.available === 11, l2);
  ok("vendedor no prepara", (await post(`/api/empresa/pedidos/${orderId}`, seller.cookie, { action: "prepare" })).status === 403);

  console.log("\n# Bodega");
  ok("bodega no ve clientes", (await get("/api/empresa/clientes", bodega.cookie)).status === 403);
  ok("bodega no ve costos", (await get("/api/empresa/productos", bodega.cookie)).body.products.every((p: any) => !("cost" in p)));
  ok("bodega no ajusta", (await post("/api/empresa/stock/mover", bodega.cookie, { type: "adjust", productId: product, warehouseId: a.wh1, quantity: 1, reason: "x", idempotencyKey: randomUUID() })).status === 403);
  ok("bodega no confirma ni crea", (await post("/api/empresa/pedidos", bodega.cookie, { customerId, warehouseId: a.wh1, items })).status === 403);
  ok("bodega no cancela", (await post(`/api/empresa/pedidos/${orderId}`, bodega.cookie, { action: "cancel" })).status === 403);
  ok("bodega ve el confirmado", (await get(`/api/empresa/pedidos/${orderId}`, bodega.cookie)).status === 200);
  ok("no se despacha sin preparar", (await post(`/api/empresa/pedidos/${orderId}`, bodega.cookie, { action: "dispatch" })).status === 409);
  ok("bodega prepara", (await post(`/api/empresa/pedidos/${orderId}`, bodega.cookie, { action: "prepare" })).body.status === "prepared");
  ok("bodega despacha", (await post(`/api/empresa/pedidos/${orderId}`, bodega.cookie, { action: "dispatch" })).body.status === "dispatched");
  const l3 = await line(owner.cookie);
  ok("el despacho descuenta", l3?.quantity === 11 && l3?.reserved === 0, l3);
  ok("el historial lo muestra", (await get(`/api/empresa/movimientos?productId=${product}`, owner.cookie)).body.movements.some((m: any) => m.movement_type === "dispatch" && m.quantity_delta === -4));
  ok("bodega entrega", (await post(`/api/empresa/pedidos/${orderId}`, bodega.cookie, { action: "deliver" })).body.status === "delivered");

  console.log("\n# Conteo a ciegas");
  const opened = await post("/api/empresa/conteos", bodega.cookie, { warehouseId: a.wh2 });
  ok("bodega abre conteo", opened.status === 201, opened);
  const countId = opened.body.id as string;
  ok("bodega anota", (await post(`/api/empresa/conteos/${countId}`, bodega.cookie, { action: "record", productId: product, counted: 3 })).status === 200);
  const blind = await get(`/api/empresa/conteos/${countId}`, bodega.cookie);
  ok("bodega no ve lo que dice el sistema", blind.status === 200 && blind.body.lines.length === 1 && !("system_quantity" in blind.body.lines[0]), blind.body);
  ok("dueño sí lo ve", "system_quantity" in (await get(`/api/empresa/conteos/${countId}`, owner.cookie)).body.lines[0]);
  ok("bodega no cierra", (await post(`/api/empresa/conteos/${countId}`, bodega.cookie, { action: "close" })).status === 403);
  ok("B no ve el conteo", (await get(`/api/empresa/conteos/${countId}`, ownerB.cookie)).status === 404);
  ok("B no lo cierra", (await post(`/api/empresa/conteos/${countId}`, ownerB.cookie, { action: "close" })).status === 404);
  const closed = await post(`/api/empresa/conteos/${countId}`, owner.cookie, { action: "close" });
  ok("dueño cierra y aplica", closed.body.status === "closed" && closed.body.productsChanged === 1, closed);

  console.log("\n# Permisos al instante");
  await must("desactivar", admin.from("company_members").update({ active: false }).eq("user_id", seller.id));
  ok("miembro desactivado queda fuera", (await get("/api/empresa/me", seller.cookie)).status === 403);
  await must("suspender", admin.from("tenants").update({ status: "suspended" }).eq("id", b.tenantId));
  const suspended = await get("/api/empresa/me", ownerB.cookie);
  await must("reactivar", admin.from("tenants").update({ status: "active" }).eq("id", b.tenantId));
  ok("empresa suspendida queda fuera", suspended.status === 402, suspended.status);
}

async function cleanup() {
  if (createdProducts.length) await admin.from("company_products").update({ active: false }).in("id", createdProducts);
  // Los movimientos conservan created_by sin FK: borrar al usuario no toca el historial.
  for (const id of createdUsers) await admin.auth.admin.deleteUser(id);
}

main()
  .catch((e) => { fails++; console.error("ERROR:", e instanceof Error ? e.message : "desconocido"); })
  .finally(async () => {
    await cleanup();
    console.log(`\n${passed} ok, ${fails} fallas`);
    console.log(fails ? `${fails} fallas` : "TODO OK");
    process.exit(fails ? 1 : 0);
  });
