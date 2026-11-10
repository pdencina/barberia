// Empresas, migraciones 154 y 155 (antes 126 y 127): pruebas reales contra el Supabase de PRUEBAS, solo con datos simulados.
// Uso (primero, una vez, scripts/test-empresas-stock.ts, que crea las empresas simuladas):
//   npx tsx scripts/test-empresas-pedidos.ts
// SEGURIDAD: se niega a correr si .env.local no apunta a rebooking-pruebas. No imprime llaves.
import { randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const PRUEBAS_REF = "ucwrdmwtlesayjxmlbve";
const SALON_PRUEBAS = "0235d97a-6658-4a1c-be69-8c1341ac50ce";
const TABLES = ["company_customers", "company_orders", "company_order_items", "company_inventory_counts", "company_inventory_count_lines"];
const NO_AUTH = { auth: { persistSession: false, autoRefreshToken: false } };

const env: Record<string, string> = {};
for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const url = env.NEXT_PUBLIC_SUPABASE_URL || "";
if (!url.includes(PRUEBAS_REF)) {
  console.error("PARADO: .env.local no apunta al proyecto de pruebas.");
  process.exit(2);
}
const admin = createClient(url, env.SUPABASE_SERVICE_ROLE_KEY, NO_AUTH);
const anon = createClient(url, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, NO_AUTH);

let fails = 0;
let passed = 0;
const ok = (name: string, cond: boolean, detail?: unknown) => {
  if (cond) { passed++; console.log("ok", name); }
  else { fails++; console.log("FALLA", name, detail ?? ""); }
};

type Company = { tenantId: string; userId: string; email: string; wh1: string; wh2: string; customer: string };
const createdProducts: string[] = [];

async function must<T>(label: string, q: PromiseLike<{ data: T; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await q;
  if (error) throw new Error(`${label}: ${error.message}`);
  return data;
}

async function loadCompany(letter: string): Promise<Company> {
  const slug = `empresa-sim-${letter}`;
  const tenant = await must("tenant", admin.from("tenants").select("id, admin_email").eq("slug", slug).maybeSingle()) as { id: string; admin_email: string } | null;
  if (!tenant) throw new Error("Faltan las empresas simuladas: corre primero scripts/test-empresas-stock.ts");
  const member = await must("miembro", admin.from("company_members").select("user_id").eq("tenant_id", tenant.id).eq("role_key", "owner").limit(1).single()) as { user_id: string };
  const whs = await must("bodegas", admin.from("company_warehouses").select("id, name").eq("tenant_id", tenant.id)) as { id: string; name: string }[];
  const customer = await must("cliente", admin.from("company_customers")
    .insert({ tenant_id: tenant.id, name: `Cliente simulado ${randomUUID().slice(0, 8)}` }).select("id").single()) as { id: string };
  return {
    tenantId: tenant.id, userId: member.user_id, email: tenant.admin_email, customer: customer.id,
    wh1: whs.find((w) => w.name === "Bodega 1")!.id, wh2: whs.find((w) => w.name === "Bodega 2")!.id,
  };
}

async function newProduct(c: Company, stock: number, wh = c.wh1): Promise<string> {
  const row = await must("producto", admin.from("company_products")
    .insert({ tenant_id: c.tenantId, name: "Simulado", sku: `SIM-${randomUUID().slice(0, 12)}` }).select("id").single()) as { id: string };
  createdProducts.push(row.id);
  if (stock > 0) await must("entrada", admin.rpc("company_stock_move", { p_tenant_id: c.tenantId, p_type: "in", p_product_id: row.id, p_warehouse_id: wh, p_quantity: stock, p_created_by: c.userId }));
  return row.id;
}

async function newOrder(c: Company, lines: [string, number][], wh = c.wh1): Promise<string> {
  const order = await must("pedido", admin.from("company_orders")
    .insert({ tenant_id: c.tenantId, customer_id: c.customer, warehouse_id: wh, created_by: c.userId }).select("id").single()) as { id: string };
  if (lines.length) await must("líneas", admin.from("company_order_items").insert(lines.map(([product_id, quantity]) => ({ order_id: order.id, tenant_id: c.tenantId, product_id, quantity }))));
  return order.id;
}

const call = (client: SupabaseClient, fn: string, c: Company, id: string, extra: Record<string, unknown> = {}, user?: string, tenant?: string) =>
  client.rpc(fn, { p_tenant_id: tenant ?? c.tenantId, p_order_id: id, p_user_id: user ?? c.userId, ...extra });
const order = (fn: string, c: Company, id: string, extra: Record<string, unknown> = {}) => call(admin, `company_order_${fn}`, c, id, extra);
const errOf = (r: { error: { message: string } | null }) => r.error?.message ?? "sin_error";
const count = (fn: string, c: Company, args: Record<string, unknown>) => admin.rpc(`company_count_${fn}`, { p_tenant_id: c.tenantId, p_user_id: c.userId, ...args });

async function stock(product: string, wh: string) {
  const { data } = await admin.from("company_warehouse_stock").select("quantity, reserved_quantity").eq("product_id", product).eq("warehouse_id", wh).maybeSingle();
  const row = data as { quantity: number; reserved_quantity: number } | null;
  return { q: row?.quantity ?? 0, r: row?.reserved_quantity ?? 0 };
}
const is = async (product: string, wh: string, q: number, r: number) => { const s = await stock(product, wh); return s.q === q && s.r === r; };
const statusOf = async (id: string) => ((await admin.from("company_orders").select("status").eq("id", id).single()).data as { status: string } | null)?.status;
async function ledgerMatches(product: string, wh: string) {
  const { data } = await admin.from("company_stock_movements").select("quantity_delta").eq("product_id", product).eq("warehouse_id", wh);
  return ((data || []) as { quantity_delta: number }[]).reduce((a, r) => a + r.quantity_delta, 0) === (await stock(product, wh)).q;
}

async function main() {
  const a = await loadCompany("a");
  const b = await loadCompany("b");

  console.log("\n# Salones");
  ok("cliente comercial en un salón se rechaza", (await admin.from("company_customers").insert({ tenant_id: SALON_PRUEBAS, name: "No" })).error?.message === "tenant_not_company");
  const pS = await newProduct(a, 1);
  const os = await newOrder(a, [[pS, 1]]);
  ok("confirmar con un salón se rechaza", errOf(await call(admin, "company_order_confirm", a, os, {}, undefined, SALON_PRUEBAS)) === "tenant_not_company");

  console.log("\n# Sin sesión y navegador");
  const password = randomBytes(24).toString("hex");
  await admin.auth.admin.updateUserById(a.userId, { password });
  const browser = createClient(url, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, NO_AUTH);
  ok("el usuario simulado inicia sesión", !(await browser.auth.signInWithPassword({ email: a.email, password })).error);
  for (const [who, client] of [["anon", anon], ["navegador", browser]] as const) {
    for (const t of TABLES) {
      const r = await client.from(t).select("*").limit(1);
      ok(`${who} no lee ${t}`, !!r.error && !(r.data as unknown[] | null)?.length, r.error?.message);
    }
    for (const fn of ["company_order_confirm", "company_order_dispatch", "company_order_cancel"]) {
      ok(`${who} no llama ${fn}`, !!(await call(client, fn, a, os)).error);
    }
    ok(`${who} no llama company_count_open`, !!(await client.rpc("company_count_open", { p_tenant_id: a.tenantId, p_warehouse_id: a.wh1, p_user_id: a.userId })).error);
  }
  ok("el pedido sigue en borrador", await statusOf(os) === "draft");

  console.log("\n# La API no cambia estados ni reservas directo");
  const denied = (e: { code?: string } | null) => e?.code === "42501";
  ok("crear pedido ya confirmado", denied((await admin.from("company_orders").insert({ tenant_id: a.tenantId, customer_id: a.customer, warehouse_id: a.wh1, created_by: a.userId, status: "confirmed" })).error));
  ok("cambiar estado directo", denied((await admin.from("company_orders").update({ status: "dispatched" }).eq("id", os)).error));
  ok("borrar pedido", denied((await admin.from("company_orders").delete().eq("id", os)).error));
  ok("cambiar reserva directo", denied((await admin.from("company_warehouse_stock").update({ reserved_quantity: 0 }).eq("product_id", pS)).error));
  ok("escribir conteo directo", denied((await admin.from("company_inventory_counts").insert({ tenant_id: a.tenantId, warehouse_id: a.wh1, created_by: a.userId })).error));

  console.log("\n# Flujo completo");
  const p = await newProduct(a, 10);
  const o1 = await newOrder(a, [[p, 4]]);
  ok("borrador no reserva", await is(p, a.wh1, 10, 0));
  const first = await order("confirm", a, o1);
  ok("confirmar reserva", !first.error && await is(p, a.wh1, 10, 4), first.error?.message);
  const again = await order("confirm", a, o1);
  ok("confirmar dos veces no reserva doble", (again.data as any)?.replayed === true && await is(p, a.wh1, 10, 4));
  ok("salida no puede usar lo reservado", errOf(await admin.rpc("company_stock_move", { p_tenant_id: a.tenantId, p_type: "out", p_product_id: p, p_warehouse_id: a.wh1, p_quantity: 7, p_created_by: a.userId })) === "insufficient_stock");
  ok("traspaso no puede usar lo reservado", errOf(await admin.rpc("company_stock_move", { p_tenant_id: a.tenantId, p_type: "transfer", p_product_id: p, p_warehouse_id: a.wh1, p_to_warehouse_id: a.wh2, p_quantity: 7, p_created_by: a.userId })) === "insufficient_stock");
  ok("salida de lo disponible sí pasa", !(await admin.rpc("company_stock_move", { p_tenant_id: a.tenantId, p_type: "out", p_product_id: p, p_warehouse_id: a.wh1, p_quantity: 6, p_created_by: a.userId })).error && await is(p, a.wh1, 4, 4));
  ok("líneas bloqueadas tras confirmar (editar)", (await admin.from("company_order_items").update({ quantity: 1 }).eq("order_id", o1)).error?.message === "order_not_editable");
  ok("líneas bloqueadas tras confirmar (borrar)", (await admin.from("company_order_items").delete().eq("order_id", o1)).error?.message === "order_not_editable");
  ok("líneas bloqueadas tras confirmar (agregar)", (await admin.from("company_order_items").insert({ order_id: o1, tenant_id: a.tenantId, product_id: pS, quantity: 1 })).error?.message === "order_not_editable");
  ok("bodega bloqueada tras confirmar", (await admin.from("company_orders").update({ warehouse_id: a.wh2 }).eq("id", o1)).error?.message === "order_not_editable");
  ok("no se despacha sin preparar", errOf(await order("dispatch", a, o1)) === "invalid_status");
  ok("preparar", !(await order("advance", a, o1, { p_to: "prepared" })).error && await statusOf(o1) === "prepared");
  ok("no se entrega sin despachar", errOf(await order("advance", a, o1, { p_to: "delivered" })) === "invalid_status");
  const d = await order("dispatch", a, o1);
  ok("despachar descuenta físico y reserva", !d.error && await is(p, a.wh1, 0, 0), d.error?.message);
  ok("despachar dos veces no descuenta doble", (await order("dispatch", a, o1)).data && await is(p, a.wh1, 0, 0));
  const { data: mv } = await admin.from("company_stock_movements").select("movement_type, quantity_delta").eq("order_id", o1);
  ok("el despacho queda en el historial", mv?.length === 1 && mv[0].movement_type === "dispatch" && mv[0].quantity_delta === -4, mv);
  ok("lo despachado no se cancela", errOf(await order("cancel", a, o1)) === "invalid_status");
  ok("entregar", !(await order("advance", a, o1, { p_to: "delivered" })).error && await statusOf(o1) === "delivered");
  ok("estado inválido", errOf(await order("advance", a, o1, { p_to: "dispatched" })) === "invalid_status");

  console.log("\n# Todo o nada y cancelar");
  const p1 = await newProduct(a, 5);
  const p2 = await newProduct(a, 1);
  const o2 = await newOrder(a, [[p1, 3], [p2, 2]]);
  const short = await order("confirm", a, o2);
  ok("falta una línea: no reserva ninguna", errOf(short) === "insufficient_stock" && await is(p1, a.wh1, 5, 0) && await is(p2, a.wh1, 1, 0));
  ok("el error indica el producto que falta", (short.error as { details?: string } | null)?.details === p2, short.error);
  ok("sigue en borrador", await statusOf(o2) === "draft");
  ok("pedido vacío", errOf(await order("confirm", a, await newOrder(a, []))) === "order_empty");
  const o3 = await newOrder(a, [[p1, 3]]);
  await order("confirm", a, o3);
  ok("cancelar libera", !(await order("cancel", a, o3, { p_reason: "Simulado" })).error && await is(p1, a.wh1, 5, 0));
  ok("cancelar dos veces no libera doble", (await order("cancel", a, o3)).data && await is(p1, a.wh1, 5, 0));
  ok("lo cancelado no se confirma", errOf(await order("confirm", a, o3)) === "invalid_status");

  console.log("\n# Cruzado entre empresas");
  ok("pedido de otra empresa", errOf(await call(admin, "company_order_confirm", b, os)) === "order_not_found");
  ok("usuario de otra empresa", errOf(await call(admin, "company_order_confirm", a, os, {}, b.userId)) === "not_a_member");
  ok("usuario inexistente", errOf(await call(admin, "company_order_cancel", a, os, {}, randomUUID())) === "not_a_member");
  ok("pedido con cliente de otra empresa", !!(await admin.from("company_orders").insert({ tenant_id: a.tenantId, customer_id: b.customer, warehouse_id: a.wh1, created_by: a.userId })).error);
  ok("pedido con bodega de otra empresa", !!(await admin.from("company_orders").insert({ tenant_id: a.tenantId, customer_id: a.customer, warehouse_id: b.wh1, created_by: a.userId })).error);
  const pB = await newProduct(b, 5, b.wh1);
  const oX = await newOrder(a, []);
  ok("línea con producto de otra empresa", !!(await admin.from("company_order_items").insert({ order_id: oX, tenant_id: a.tenantId, product_id: pB, quantity: 1 })).error);
  ok("línea con tenant ajeno", !!(await admin.from("company_order_items").insert({ order_id: oX, tenant_id: b.tenantId, product_id: pB, quantity: 1 })).error);
  ok("el stock de B no cambió", await is(pB, b.wh1, 5, 0));

  console.log("\n# Concurrencia");
  const pV = await newProduct(a, 10);
  const orders = await Promise.all(Array.from({ length: 30 }, () => newOrder(a, [[pV, 1]])));
  const res = await Promise.all(orders.map((id) => order("confirm", a, id)));
  const won = res.filter((r) => !r.error).length;
  ok("30 pedidos por 10 unidades: pasan 10", won === 10 && res.filter((r) => errOf(r) === "insufficient_stock").length === 20, { won, otros: res.find((r) => r.error && errOf(r) !== "insufficient_stock")?.error });
  ok("reservado = 10, físico intacto", await is(pV, a.wh1, 10, 10));

  const pZ = await newProduct(a, 5);
  const oZ = await newOrder(a, [[pZ, 2]]);
  const same = await Promise.all(Array.from({ length: 20 }, () => order("confirm", a, oZ)));
  ok("20 confirmaciones del mismo pedido reservan una vez", same.every((r) => !r.error) && await is(pZ, a.wh1, 5, 2));

  const pL = await newProduct(a, 100);
  const pM = await newProduct(a, 100);
  const crossed = await Promise.all(Array.from({ length: 30 }, (_, i) => newOrder(a, i % 2 ? [[pL, 1], [pM, 1]] : [[pM, 1], [pL, 1]])));
  const cr = await Promise.all(crossed.map((id) => order("confirm", a, id)));
  ok("30 pedidos con líneas cruzadas sin bloqueo mutuo", cr.every((r) => !r.error) && await is(pL, a.wh1, 100, 30) && await is(pM, a.wh1, 100, 30), cr.find((r) => r.error)?.error?.message);

  const pR = await newProduct(a, 5);
  const oR = await newOrder(a, [[pR, 3]]);
  await order("confirm", a, oR);
  await order("advance", a, oR, { p_to: "prepared" });
  const race = await Promise.all([order("dispatch", a, oR), order("cancel", a, oR)]);
  const finalStatus = await statusOf(oR);
  ok("despachar y cancelar a la vez: gana uno solo", (finalStatus === "dispatched" && await is(pR, a.wh1, 2, 0)) || (finalStatus === "cancelled" && await is(pR, a.wh1, 5, 0)), { finalStatus, race: race.map(errOf) });

  console.log("\n# Toma de inventario");
  const pC = await newProduct(a, 10);
  const pD = await newProduct(a, 10);
  const pE = await newProduct(a, 10);
  const opened = await count("open", a, { p_warehouse_id: a.wh2 });
  const c1 = opened.data as string;
  ok("abrir conteo", !opened.error, opened.error?.message);
  ok("solo un conteo abierto por bodega", errOf(await count("open", a, { p_warehouse_id: a.wh2 })) === "count_already_open");
  ok("cancelar conteo", !(await count("cancel", a, { p_count_id: c1 })).error);
  const c2 = (await count("open", a, { p_warehouse_id: a.wh1 })).data as string;
  ok("cantidad contada negativa", errOf(await count("record", a, { p_count_id: c2, p_product_id: pC, p_counted: -1 })) === "invalid_quantity");
  ok("producto de otra empresa", errOf(await count("record", a, { p_count_id: c2, p_product_id: pB, p_counted: 1 })) === "product_not_found");
  ok("conteo de otra empresa", errOf(await admin.rpc("company_count_close", { p_tenant_id: b.tenantId, p_count_id: c2, p_user_id: b.userId })) === "count_not_found");
  await count("record", a, { p_count_id: c2, p_product_id: pC, p_counted: 99 });
  ok("contar de nuevo reemplaza", !(await count("record", a, { p_count_id: c2, p_product_id: pC, p_counted: 7 })).error);
  await count("record", a, { p_count_id: c2, p_product_id: pD, p_counted: 12 });
  ok("contar no mueve el stock hasta cerrar", await is(pC, a.wh1, 10, 0));
  await admin.rpc("company_stock_move", { p_tenant_id: a.tenantId, p_type: "out", p_product_id: pC, p_warehouse_id: a.wh1, p_quantity: 2, p_created_by: a.userId });
  const closed = await count("close", a, { p_count_id: c2 });
  ok("cerrar aplica diferencias", !closed.error && (closed.data as any)?.products_changed === 2, closed.error?.message);
  ok("lo vendido durante el conteo no se pisa (10 - 2 - 3)", await is(pC, a.wh1, 5, 0), await stock(pC, a.wh1));
  ok("faltante y sobrante quedan bien", await is(pD, a.wh1, 12, 0));
  ok("lo no contado queda igual", await is(pE, a.wh1, 10, 0));
  ok("cerrar dos veces no aplica doble", (await count("close", a, { p_count_id: c2 })).data && await is(pD, a.wh1, 12, 0));
  ok("conteo cerrado no acepta más líneas", errOf(await count("record", a, { p_count_id: c2, p_product_id: pE, p_counted: 1 })) === "count_not_open");
  const { data: cm } = await admin.from("company_stock_movements").select("movement_type").eq("count_id", c2);
  ok("las diferencias quedan en el historial", cm?.length === 2 && cm.every((m) => m.movement_type === "count"));

  console.log("\n# Conteo con menos unidades que las reservadas");
  const pF = await newProduct(a, 10);
  const oF = await newOrder(a, [[pF, 8]]);
  await order("confirm", a, oF);
  await order("advance", a, oF, { p_to: "prepared" });
  const c3 = (await count("open", a, { p_warehouse_id: a.wh1 })).data as string;
  await count("record", a, { p_count_id: c3, p_product_id: pF, p_counted: 5 });
  ok("el físico manda: se aplica aunque quede bajo lo reservado", !(await count("close", a, { p_count_id: c3 })).error && await is(pF, a.wh1, 5, 8));
  ok("el pedido no se puede despachar sin stock real", errOf(await order("dispatch", a, oF)) === "insufficient_stock" && await is(pF, a.wh1, 5, 8));
  ok("nuevos pedidos no toman stock inexistente", errOf(await order("confirm", a, await newOrder(a, [[pF, 1]]))) === "insufficient_stock");
  ok("cancelar lo normaliza", !(await order("cancel", a, oF)).error && await is(pF, a.wh1, 5, 0));

  console.log("\n# Conflicto al cerrar");
  const pG = await newProduct(a, 10);
  const c4 = (await count("open", a, { p_warehouse_id: a.wh1 })).data as string;
  await count("record", a, { p_count_id: c4, p_product_id: pG, p_counted: 2 });
  await admin.rpc("company_stock_move", { p_tenant_id: a.tenantId, p_type: "out", p_product_id: pG, p_warehouse_id: a.wh1, p_quantity: 9, p_created_by: a.userId });
  const conflict = await count("close", a, { p_count_id: c4 });
  ok("si no calza pide recontar, sin mover nada", errOf(conflict) === "count_conflict" && await is(pG, a.wh1, 1, 0), conflict.error);
  await count("record", a, { p_count_id: c4, p_product_id: pG, p_counted: 1 });
  ok("recontado, cierra", !(await count("close", a, { p_count_id: c4 })).error && await is(pG, a.wh1, 1, 0));

  console.log("\n# Todo cuadra");
  for (const [name, prod] of [["flujo", p], ["ventas", pV], ["carrera", pR], ["conteo 1", pC], ["conteo 2", pD], ["faltante", pF], ["conflicto", pG]] as const) {
    ok(`suma de movimientos = físico (${name})`, await ledgerMatches(prod, a.wh1));
  }
  const { data: rows } = await admin.from("company_warehouse_stock").select("warehouse_id, product_id, reserved_quantity").eq("tenant_id", a.tenantId);
  const { data: active } = await admin.from("company_orders").select("warehouse_id, company_order_items(product_id, quantity)").eq("tenant_id", a.tenantId).in("status", ["confirmed", "prepared"]);
  const expected = new Map<string, number>();
  for (const o of (active || []) as any[]) for (const i of o.company_order_items) {
    const k = `${o.warehouse_id}:${i.product_id}`;
    expected.set(k, (expected.get(k) || 0) + i.quantity);
  }
  const bad = ((rows || []) as any[]).filter((r) => r.reserved_quantity !== (expected.get(`${r.warehouse_id}:${r.product_id}`) || 0));
  ok("lo reservado = suma de pedidos activos", bad.length === 0, bad.length);

  await admin.from("company_products").update({ active: false }).in("id", createdProducts);
  console.log(`\n${passed} ok, ${fails} fallas`);
  console.log(fails ? `${fails} fallas` : "TODO OK");
  process.exit(fails ? 1 : 0);
}

main().catch((e) => { console.error("ERROR:", e instanceof Error ? e.message : "desconocido"); process.exit(1); });
