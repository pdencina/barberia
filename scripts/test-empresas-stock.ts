// Empresas, migración 153 (antes 125): pruebas reales contra el Supabase de PRUEBAS, solo con datos simulados.
// Uso: npx tsx scripts/test-empresas-stock.ts
// SEGURIDAD: se niega a correr si .env.local no apunta a rebooking-pruebas. No imprime llaves.
// Es re-ejecutable: las empresas simuladas se reutilizan y cada corrida crea productos nuevos (quedan inactivos al final).
import { randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const PRUEBAS_REF = "ucwrdmwtlesayjxmlbve";
const SALON_PRUEBAS = "0235d97a-6658-4a1c-be69-8c1341ac50ce";
const TABLES = ["company_members", "company_warehouses", "company_products", "company_warehouse_stock", "company_stock_movements"];
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

type Company = { tenantId: string; userId: string; email: string; wh1: string; wh2: string; wh3: string };

async function must<T>(label: string, q: PromiseLike<{ data: T; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await q;
  if (error) throw new Error(`${label}: ${error.message}`);
  return data;
}

async function ensureCompany(letter: string): Promise<Company> {
  const slug = `empresa-sim-${letter}`;
  const email = `${slug}@example.invalid`;
  let tenant = await must("tenant", admin.from("tenants").select("id").eq("slug", slug).maybeSingle()) as { id: string } | null;
  if (!tenant) {
    tenant = await must("crear tenant", admin.from("tenants")
      .insert({ name: `Empresa simulada ${letter.toUpperCase()}`, slug, admin_email: email, kind: "company" })
      .select("id").single()) as { id: string };
  }
  let userId = "";
  const list = await admin.auth.admin.listUsers({ perPage: 1000 });
  userId = list.data?.users.find((u) => u.email === email)?.id || "";
  if (!userId) {
    const created = await admin.auth.admin.createUser({ email, email_confirm: true, password: randomBytes(24).toString("hex"), user_metadata: { name: `Usuario simulado ${letter}` } });
    if (created.error || !created.data.user) throw new Error(`crear usuario: ${created.error?.message}`);
    userId = created.data.user.id;
  }
  await must("perfil", admin.from("profiles").upsert({ id: userId, name: `Usuario simulado ${letter}`, email, tenant_id: tenant.id }));
  await must("miembro", admin.from("company_members").upsert({ tenant_id: tenant.id, user_id: userId, role_key: "owner", active: true }, { onConflict: "tenant_id,user_id" }));
  const ids: string[] = [];
  for (const name of ["Bodega 1", "Bodega 2", "Bodega inactiva"]) {
    const row = await must("bodega", admin.from("company_warehouses")
      .upsert({ tenant_id: tenant.id, name, active: name !== "Bodega inactiva" }, { onConflict: "tenant_id,name" })
      .select("id").single()) as { id: string };
    ids.push(row.id);
  }
  return { tenantId: tenant.id, userId, email, wh1: ids[0], wh2: ids[1], wh3: ids[2] };
}

const createdProducts: string[] = [];
async function newProduct(c: Company, label: string): Promise<string> {
  const row = await must("producto", admin.from("company_products")
    .insert({ tenant_id: c.tenantId, name: `Simulado ${label}`, sku: `SIM-${label}-${randomUUID().slice(0, 8)}` })
    .select("id").single()) as { id: string };
  createdProducts.push(row.id);
  return row.id;
}

type Move = { type: string; product: string; wh: string; qty: number; to?: string; reason?: string; key?: string; by?: string; tenant?: string };
const move = (client: SupabaseClient, c: Company, m: Move) => client.rpc("company_stock_move", {
  p_tenant_id: m.tenant ?? c.tenantId, p_type: m.type, p_product_id: m.product, p_warehouse_id: m.wh, p_quantity: m.qty,
  p_created_by: m.by ?? c.userId, p_to_warehouse_id: m.to ?? null, p_reason: m.reason ?? null, p_idempotency_key: m.key ?? null,
});
const err = async (c: Company, m: Move) => (await move(admin, c, m)).error?.message ?? "sin_error";

async function qty(product: string, wh: string): Promise<number> {
  const { data } = await admin.from("company_warehouse_stock").select("quantity").eq("product_id", product).eq("warehouse_id", wh).maybeSingle();
  return (data as { quantity: number } | null)?.quantity ?? 0;
}
async function ledgerMatches(product: string, wh: string): Promise<boolean> {
  const { data } = await admin.from("company_stock_movements").select("quantity_delta").eq("product_id", product).eq("warehouse_id", wh);
  const sum = ((data || []) as { quantity_delta: number }[]).reduce((a, r) => a + r.quantity_delta, 0);
  return sum === await qty(product, wh);
}

async function main() {
  const a = await ensureCompany("a");
  const b = await ensureCompany("b");
  const p = await newProduct(a, "flujo");
  const pB = await newProduct(b, "otra");

  console.log("\n# Salones sin cambios");
  const salon = await must("salon", admin.from("tenants").select("kind").eq("id", SALON_PRUEBAS).single()) as { kind: string };
  ok("el salón de pruebas sigue como salon", salon.kind === "salon");
  const companies = await must("kinds", admin.from("tenants").select("slug").eq("kind", "company")) as { slug: string }[];
  ok("solo las empresas simuladas son company", companies.every((t) => t.slug.startsWith("empresa-sim-") || t.slug === "empresa-demo"), companies);
  for (const [table, row] of [
    ["company_warehouses", { tenant_id: SALON_PRUEBAS, name: "No debe existir" }],
    ["company_products", { tenant_id: SALON_PRUEBAS, name: "No debe existir" }],
    ["company_members", { tenant_id: SALON_PRUEBAS, user_id: a.userId, role_key: "owner" }],
  ] as const) {
    const { error } = await admin.from(table).insert(row);
    ok(`${table} rechaza un salón`, error?.message === "tenant_not_company", error?.message);
  }
  ok("mover stock en un salón se rechaza", await err(a, { type: "in", product: p, wh: a.wh1, qty: 1, tenant: SALON_PRUEBAS }) === "tenant_not_company");

  console.log("\n# Sin sesión (anon)");
  for (const t of TABLES) {
    const r = await anon.from(t).select("*").limit(1);
    ok(`anon no lee ${t}`, !!r.error && !(r.data as unknown[] | null)?.length, r.error?.message);
    const w = await anon.from(t).insert({ tenant_id: a.tenantId });
    ok(`anon no escribe ${t}`, !!w.error);
  }
  ok("anon no puede llamar la función", !!(await move(anon, a, { type: "in", product: p, wh: a.wh1, qty: 5 })).error);

  console.log("\n# Con sesión de navegador (authenticated), incluso siendo miembro");
  const password = randomBytes(24).toString("hex");
  await admin.auth.admin.updateUserById(a.userId, { password });
  const browser = createClient(url, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, NO_AUTH);
  const login = await browser.auth.signInWithPassword({ email: a.email, password });
  ok("el usuario simulado inicia sesión", !login.error, login.error?.message);
  for (const t of TABLES) {
    const r = await browser.from(t).select("*").limit(1);
    ok(`navegador no lee ${t}`, !!r.error && !(r.data as unknown[] | null)?.length, r.error?.message);
  }
  ok("navegador no puede llamar la función", !!(await move(browser, a, { type: "in", product: p, wh: a.wh1, qty: 5 })).error);
  ok("nada se movió", await qty(p, a.wh1) === 0);
  const flip = await browser.from("tenants").update({ kind: "salon" }).eq("id", a.tenantId);
  ok("navegador no cambia kind de su empresa", flip.error?.message === "kind_protected", flip.error?.message);
  const flipSalon = await browser.from("tenants").update({ kind: "company" }).eq("id", SALON_PRUEBAS);
  ok("navegador no convierte un salón en empresa", flipSalon.error?.message === "kind_protected", flipSalon.error?.message);
  const salonAfter = await must("salon", admin.from("tenants").select("kind").eq("id", SALON_PRUEBAS).single()) as { kind: string };
  ok("el salón sigue como salon", salonAfter.kind === "salon");

  console.log("\n# La API no puede escribir stock directo (ni con llave de servicio)");
  const denied = (e: { code?: string } | null) => e?.code === "42501";
  ok("insert a stock denegado", denied((await admin.from("company_warehouse_stock").insert({ tenant_id: a.tenantId, warehouse_id: a.wh1, product_id: p, quantity: 99 })).error));
  ok("update a stock denegado", denied((await admin.from("company_warehouse_stock").update({ quantity: 99 }).eq("product_id", p)).error));
  ok("delete a stock denegado", denied((await admin.from("company_warehouse_stock").delete().eq("product_id", p)).error));
  ok("insert a movimientos denegado", denied((await admin.from("company_stock_movements").insert({ tenant_id: a.tenantId, warehouse_id: a.wh1, product_id: p, movement_type: "in", quantity_delta: 1, balance_after: 1, created_by: a.userId })).error));
  ok("update a movimientos denegado", denied((await admin.from("company_stock_movements").update({ quantity_delta: 9 }).eq("product_id", p)).error));
  ok("delete a movimientos denegado", denied((await admin.from("company_stock_movements").delete().eq("product_id", p)).error));

  console.log("\n# Movimientos normales");
  ok("entrada", (await move(admin, a, { type: "in", product: p, wh: a.wh1, qty: 10 })).error === null && await qty(p, a.wh1) === 10);
  ok("salida", (await move(admin, a, { type: "out", product: p, wh: a.wh1, qty: 3 })).error === null && await qty(p, a.wh1) === 7);
  ok("ajuste negativo", (await move(admin, a, { type: "adjust", product: p, wh: a.wh1, qty: -2, reason: "Conteo simulado" })).error === null && await qty(p, a.wh1) === 5);
  ok("ajuste positivo", (await move(admin, a, { type: "adjust", product: p, wh: a.wh1, qty: 1, reason: "Conteo simulado" })).error === null && await qty(p, a.wh1) === 6);
  const tr = await move(admin, a, { type: "transfer", product: p, wh: a.wh1, to: a.wh2, qty: 4 });
  ok("traspaso", tr.error === null && await qty(p, a.wh1) === 2 && await qty(p, a.wh2) === 4, tr.error?.message);
  const legs = (tr.data as { movements: { transfer_id: string; quantity_delta: number }[] }).movements;
  ok("el traspaso anota dos filas unidas", legs.length === 2 && legs[0].transfer_id === legs[1].transfer_id && legs[0].quantity_delta === -4 && legs[1].quantity_delta === 4);

  console.log("\n# Rechazos (y sin dejar nada a medias)");
  ok("salida sin stock", await err(a, { type: "out", product: p, wh: a.wh1, qty: 3 }) === "insufficient_stock");
  ok("ajuste bajo cero", await err(a, { type: "adjust", product: p, wh: a.wh1, qty: -3, reason: "x" }) === "insufficient_stock");
  ok("traspaso sin stock", await err(a, { type: "transfer", product: p, wh: a.wh1, to: a.wh2, qty: 3 }) === "insufficient_stock");
  ok("saldos intactos tras rechazos", await qty(p, a.wh1) === 2 && await qty(p, a.wh2) === 4);
  ok("traspaso a la misma bodega", await err(a, { type: "transfer", product: p, wh: a.wh1, to: a.wh1, qty: 1 }) === "invalid_transfer");
  ok("traspaso sin destino", await err(a, { type: "transfer", product: p, wh: a.wh1, qty: 1 }) === "invalid_transfer");
  ok("destino en una entrada", await err(a, { type: "in", product: p, wh: a.wh1, to: a.wh2, qty: 1 }) === "invalid_transfer");
  ok("cantidad cero", await err(a, { type: "in", product: p, wh: a.wh1, qty: 0 }) === "invalid_quantity");
  ok("cantidad negativa", await err(a, { type: "in", product: p, wh: a.wh1, qty: -1 }) === "invalid_quantity");
  ok("cantidad gigante", await err(a, { type: "in", product: p, wh: a.wh1, qty: 1000000001 }) === "invalid_quantity");
  ok("tipo inválido", await err(a, { type: "robar", product: p, wh: a.wh1, qty: 1 }) === "invalid_type");
  ok("ajuste sin motivo", await err(a, { type: "adjust", product: p, wh: a.wh1, qty: 1 }) === "reason_required");
  ok("ajuste con motivo en blanco", await err(a, { type: "adjust", product: p, wh: a.wh1, qty: 1, reason: "   " }) === "reason_required");
  ok("bodega inactiva", await err(a, { type: "in", product: p, wh: a.wh3, qty: 1 }) === "warehouse_not_found");
  const pTope = await newProduct(a, "tope");
  await move(admin, a, { type: "in", product: pTope, wh: a.wh1, qty: 1000000000 });
  await move(admin, a, { type: "in", product: pTope, wh: a.wh1, qty: 1000000000 });
  ok("tope de saldo", await err(a, { type: "in", product: pTope, wh: a.wh1, qty: 1 }) === "quantity_out_of_range");

  console.log("\n# Cruzado entre empresas");
  ok("producto de otra empresa", await err(a, { type: "in", product: pB, wh: a.wh1, qty: 1 }) === "product_not_found");
  ok("bodega de otra empresa", await err(a, { type: "in", product: p, wh: b.wh1, qty: 1 }) === "warehouse_not_found");
  ok("traspaso hacia bodega de otra empresa", await err(a, { type: "transfer", product: p, wh: a.wh1, to: b.wh1, qty: 1 }) === "warehouse_not_found");
  ok("usuario de otra empresa", await err(a, { type: "in", product: p, wh: a.wh1, qty: 1, by: b.userId }) === "not_a_member");
  ok("usuario inexistente", await err(a, { type: "in", product: p, wh: a.wh1, qty: 1, by: randomUUID() }) === "not_a_member");
  ok("saldos de A intactos", await qty(p, a.wh1) === 2);
  ok("B no ganó stock", await qty(pB, b.wh1) === 0);
  const skuA = randomUUID().slice(0, 8);
  const sku1 = await admin.from("company_products").insert({ tenant_id: a.tenantId, name: "SKU A", sku: skuA }).select("id").single();
  const sku2 = await admin.from("company_products").insert({ tenant_id: b.tenantId, name: "SKU B", sku: skuA }).select("id").single();
  ok("dos empresas pueden usar el mismo SKU", !sku1.error && !sku2.error, sku2.error?.message);
  if (sku1.data) createdProducts.push(sku1.data.id);
  if (sku2.data) createdProducts.push(sku2.data.id);
  ok("SKU repetido en la misma empresa se rechaza", !!(await admin.from("company_products").insert({ tenant_id: a.tenantId, name: "SKU A2", sku: skuA })).error);

  console.log("\n# Miembro desactivado");
  const { error: deactivateError } = await admin.from("company_members").update({ active: false }).eq("tenant_id", a.tenantId).eq("user_id", a.userId);
  const inactive = await err(a, { type: "in", product: p, wh: a.wh1, qty: 1 });
  await admin.from("company_members").update({ active: true }).eq("tenant_id", a.tenantId).eq("user_id", a.userId);
  ok("miembro inactivo no mueve stock", !deactivateError && inactive === "not_a_member", inactive);

  console.log("\n# Reintentos (idempotencia)");
  const pI = await newProduct(a, "reintento");
  const key = randomUUID();
  const r1 = await move(admin, a, { type: "in", product: pI, wh: a.wh1, qty: 5, key });
  const r2 = await move(admin, a, { type: "in", product: pI, wh: a.wh1, qty: 5, key });
  ok("reintento no duplica", await qty(pI, a.wh1) === 5, await qty(pI, a.wh1));
  ok("reintento avisa replayed", (r1.data as any)?.replayed === false && (r2.data as any)?.replayed === true);
  ok("misma llave con otra cantidad", await err(a, { type: "in", product: pI, wh: a.wh1, qty: 6, key }) === "idempotency_conflict");
  ok("misma llave con otra bodega", await err(a, { type: "in", product: pI, wh: a.wh2, qty: 5, key }) === "idempotency_conflict");
  const keyT = randomUUID();
  await move(admin, a, { type: "transfer", product: pI, wh: a.wh1, to: a.wh2, qty: 2, key: keyT });
  const t2 = await move(admin, a, { type: "transfer", product: pI, wh: a.wh1, to: a.wh2, qty: 2, key: keyT });
  ok("reintento de traspaso no duplica", (t2.data as any)?.replayed === true && await qty(pI, a.wh1) === 3 && await qty(pI, a.wh2) === 2);
  ok("traspaso invertido con la misma llave", await err(a, { type: "transfer", product: pI, wh: a.wh2, to: a.wh1, qty: 2, key: keyT }) === "idempotency_conflict");

  console.log("\n# Concurrencia");
  const pC = await newProduct(a, "carrera");
  const firstIn = await Promise.all(Array.from({ length: 30 }, () => move(admin, a, { type: "in", product: pC, wh: a.wh1, qty: 1 })));
  ok("30 entradas simultáneas sobre fila nueva", firstIn.every((r) => !r.error) && await qty(pC, a.wh1) === 30, firstIn.find((r) => r.error)?.error?.message);

  const pV = await newProduct(a, "ultimas");
  await move(admin, a, { type: "in", product: pV, wh: a.wh1, qty: 10 });
  const sells = await Promise.all(Array.from({ length: 50 }, () => move(admin, a, { type: "out", product: pV, wh: a.wh1, qty: 1 })));
  const sold = sells.filter((r) => !r.error).length;
  const rejected = sells.filter((r) => r.error?.message === "insufficient_stock").length;
  ok("50 ventas por 10 unidades: exactamente 10 pasan", sold === 10 && rejected === 40, { sold, rejected });
  ok("el stock queda en 0, nunca negativo", await qty(pV, a.wh1) === 0);

  const pT = await newProduct(a, "cruce");
  await move(admin, a, { type: "in", product: pT, wh: a.wh1, qty: 100 });
  await move(admin, a, { type: "in", product: pT, wh: a.wh2, qty: 100 });
  const cross = await Promise.all(Array.from({ length: 60 }, (_, i) => move(admin, a, {
    type: "transfer", product: pT, wh: i % 2 ? a.wh1 : a.wh2, to: i % 2 ? a.wh2 : a.wh1, qty: 1,
  })));
  ok("60 traspasos opuestos sin bloqueo mutuo", cross.every((r) => !r.error), cross.find((r) => r.error)?.error?.message);
  ok("el total se conserva", await qty(pT, a.wh1) + await qty(pT, a.wh2) === 200);

  const pK = await newProduct(a, "doble-clic");
  const dbl = randomUUID();
  const clicks = await Promise.all(Array.from({ length: 20 }, () => move(admin, a, { type: "in", product: pK, wh: a.wh1, qty: 7, key: dbl })));
  ok("20 reintentos simultáneos: se aplica una sola vez", clicks.every((r) => !r.error) && await qty(pK, a.wh1) === 7, clicks.find((r) => r.error)?.error?.message);
  ok("solo uno se aplicó, 19 respondieron replayed", clicks.filter((r) => (r.data as any)?.replayed === false).length === 1);

  console.log("\n# El historial cuadra con el saldo");
  for (const [name, prod, wh] of [["flujo 1", p, a.wh1], ["flujo 2", p, a.wh2], ["ventas", pV, a.wh1], ["cruce 1", pT, a.wh1], ["cruce 2", pT, a.wh2], ["reintentos", pK, a.wh1]] as const) {
    ok(`suma de movimientos = saldo (${name})`, await ledgerMatches(prod, wh));
  }

  await admin.from("company_products").update({ active: false }).in("id", createdProducts);
  console.log(`\n${passed} ok, ${fails} fallas`);
  console.log(fails ? `${fails} fallas` : "TODO OK");
  process.exit(fails ? 1 : 0);
}

main().catch((e) => { console.error("ERROR:", e instanceof Error ? e.message : "desconocido"); process.exit(1); });
