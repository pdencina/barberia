import { NextResponse } from "next/server";
import { fetchAllRows } from "@/lib/accounting";
import { loadMembers } from "@/lib/empresas/cartera-data";
import { badRequest, dbErrorResponse, isUuid, readJson } from "@/lib/empresas/errors";
import { requireCompany } from "@/lib/empresas/guard";
import { BRAND_COLORS } from "@/lib/empresas/dashboard";
import { MAX_IMPORT_ROWS, parseCustomers, parseProducts, type RowError } from "@/lib/empresas/import";
import { createAdminSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Admin = ReturnType<typeof createAdminSupabase>;

// Corre tareas de a `size` en paralelo (llamadas a la base una por fila de stock).
async function inBatches<T>(list: T[], size: number, fn: (x: T) => Promise<void>) {
  for (let i = 0; i < list.length; i += size) await Promise.all(list.slice(i, i + size).map(fn));
}

const pick = (o: Record<string, unknown>) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null && v !== undefined));

/**
 * Importa productos o clientes desde las filas de un Excel/CSV (el navegador solo lee el archivo; aquí se interpreta todo).
 * dryRun: true → solo muestra lo que haría. Nunca borra ni deja en blanco un dato existente: solo crea o completa.
 * Stock: es stock INICIAL. Si el producto ya tiene stock en esa bodega, no se toca (para corregirlo está la toma de inventario).
 */
export async function POST(req: Request) {
  const g = await requireCompany("importar");
  if (!g.ok) return g.response;
  const body = await readJson(req);
  const kind = body?.kind;
  const rows = body?.rows;
  if (kind !== "productos" && kind !== "clientes") return badRequest("Elige qué vas a importar.");
  if (!Array.isArray(rows) || rows.length < 2) return badRequest("El archivo no tiene filas.");
  if (rows.length > MAX_IMPORT_ROWS + 1) return badRequest(`Máximo ${MAX_IMPORT_ROWS} filas por archivo.`);
  if (!rows.every((r) => Array.isArray(r) && r.length <= 60)) return badRequest("El archivo no tiene un formato válido.");
  const dryRun = body?.dryRun !== false;
  const admin = createAdminSupabase();
  try {
    return kind === "productos"
      ? await importProducts(admin, g, rows as unknown[][], dryRun, isUuid(body?.warehouseId) ? body.warehouseId : null)
      : await importCustomers(admin, g, rows as unknown[][], dryRun);
  } catch (e: any) {
    return dbErrorResponse(e, `importar ${kind}`);
  }
}

async function importProducts(admin: Admin, g: { tenantId: string; userId: string }, rows: unknown[][], dryRun: boolean, warehouseId: string | null) {
  const parsed = parseProducts(rows);
  if (parsed.missing.length) return badRequest(`No encontré la columna: ${parsed.missing.join(", ")}.`);
  const errors: RowError[] = [...parsed.errors];

  const existing = await fetchAllRows(() => admin.from("company_products").select("id, sku, name").eq("tenant_id", g.tenantId)) as { id: string; sku: string | null; name: string }[];
  const bySku = new Map(existing.filter((p) => p.sku).map((p) => [p.sku!.toLowerCase(), p.id]));
  const byName = new Map(existing.map((p) => [p.name.toLowerCase(), p.id]));
  const { data: whs, error: whError } = await admin.from("company_warehouses").select("id, name, active").eq("tenant_id", g.tenantId);
  if (whError) throw whError;
  const activeWhs = (whs || []).filter((w) => w.active);
  const whByName = new Map(activeWhs.map((w) => [w.name.toLowerCase(), w.id]));
  const defaultWh = warehouseId && activeWhs.some((w) => w.id === warehouseId) ? warehouseId : activeWhs.length === 1 ? activeWhs[0].id : null;

  const plan = parsed.items.map((it) => {
    const id = (it.sku && bySku.get(it.sku.toLowerCase())) || (!it.sku ? byName.get(it.name.toLowerCase()) : undefined) || null;
    let wh: string | null = null;
    if (it.stock !== null && it.stock > 0) {
      wh = it.warehouse ? whByName.get(it.warehouse.toLowerCase()) ?? null : defaultWh;
      if (!wh) errors.push({ row: it.row, message: it.warehouse ? `No existe la bodega "${it.warehouse}": el producto se importa sin stock.` : "Elige la bodega del stock: el producto se importa sin stock." });
    }
    return { it, id, wh };
  });
  const toCreate = plan.filter((p) => !p.id);
  const toUpdate = plan.filter((p) => p.id);
  const withStock = plan.filter((p) => p.wh);
  // Marcas del archivo (columna "Marca"): se usan las existentes y se crean las que falten (sin la 162, se ignoran).
  const brandNames = Array.from(new Set(plan.map((p) => p.it.brand).filter((b): b is string => !!b)));
  const brandId = new Map<string, string>();
  let newBrands: string[] = [];
  if (brandNames.length) {
    const { data: existingBrands, error: bErr } = await admin.from("company_brands").select("id, name").eq("tenant_id", g.tenantId);
    if (!bErr) {
      for (const b of existingBrands || []) brandId.set(b.name.toLowerCase(), b.id);
      newBrands = brandNames.filter((n) => !brandId.has(n.toLowerCase()));
    }
  }

  if (dryRun) {
    return NextResponse.json({
      dryRun: true, create: toCreate.length, update: toUpdate.length, stockRows: withStock.length, newBrands, errors: errors.slice(0, 200),
      preview: plan.slice(0, 15).map((p) => ({ row: p.it.row, sku: p.it.sku, name: p.it.name, price: p.it.listPrice, stock: p.it.stock, action: p.id ? "actualizar" : "crear" })),
    });
  }

  for (let i = 0; i < newBrands.length; i++) {
    const name = newBrands[i];
    const { data: b } = await admin.from("company_brands").insert({ tenant_id: g.tenantId, name, color: BRAND_COLORS[(brandId.size + i) % BRAND_COLORS.length], sort: brandId.size + i })
      .select("id").single();
    if (b) brandId.set(name.toLowerCase(), b.id);
  }
  const fields = (it: (typeof plan)[number]["it"]) => pick({
    name: it.name, description: it.description, category: it.category, unit: it.unit,
    list_price: it.listPrice, cost: it.cost, min_stock: it.minStock,
    brand_id: it.brand ? brandId.get(it.brand.toLowerCase()) : undefined,
  });
  for (let i = 0; i < toCreate.length; i += 500) {
    const chunk = toCreate.slice(i, i + 500);
    const { data, error } = await admin.from("company_products")
      .insert(chunk.map((p) => ({ tenant_id: g.tenantId, sku: p.it.sku, ...fields(p.it) }))).select("id, sku, name");
    if (error) throw error;
    // Se asocia cada fila creada a su id para poder cargarle el stock.
    (data || []).forEach((row, j) => { chunk[j].id = row.id; });
  }
  await inBatches(toUpdate, 10, async (p) => {
    const { error } = await admin.from("company_products").update(fields(p.it)).eq("tenant_id", g.tenantId).eq("id", p.id!);
    if (error) errors.push({ row: p.it.row, message: "No se pudo actualizar el producto." });
  });

  let stockApplied = 0;
  let stockSkipped = 0;
  await inBatches(withStock.filter((p) => p.id), 10, async (p) => {
    const { data: current } = await admin.from("company_warehouse_stock").select("quantity")
      .eq("warehouse_id", p.wh!).eq("product_id", p.id!).maybeSingle();
    if ((current?.quantity ?? 0) > 0) { stockSkipped++; return; }
    const { data, error } = await admin.rpc("company_stock_move", {
      p_tenant_id: g.tenantId, p_type: "in", p_product_id: p.id, p_warehouse_id: p.wh, p_quantity: p.it.stock,
      p_created_by: g.userId, p_reason: "Stock inicial (importación)", p_idempotency_key: `importacion:${p.id}:${p.wh}`,
    });
    if (error) { errors.push({ row: p.it.row, message: "No se pudo cargar el stock." }); return; }
    if (data?.replayed) stockSkipped++;
    else stockApplied++;
  });

  return NextResponse.json({ dryRun: false, created: toCreate.length, updated: toUpdate.length, stockApplied, stockSkipped, newBrands: newBrands.length, errors: errors.slice(0, 200) });
}

async function importCustomers(admin: Admin, g: { tenantId: string }, rows: unknown[][], dryRun: boolean) {
  const parsed = parseCustomers(rows);
  if (parsed.missing.length) return badRequest(`No encontré la columna: ${parsed.missing.join(", ")}.`);
  const errors: RowError[] = [...parsed.errors];

  const existing = await fetchAllRows(() => admin.from("company_customers").select("id, tax_id, name").eq("tenant_id", g.tenantId)) as { id: string; tax_id: string | null; name: string }[];
  const byRut = new Map(existing.filter((c) => c.tax_id).map((c) => [c.tax_id!.toUpperCase(), c.id]));
  const byName = new Map(existing.map((c) => [c.name.toLowerCase(), c.id]));
  const members = (await loadMembers(admin, g.tenantId)).filter((m) => m.active && (m.role === "seller" || m.role === "owner"));
  const sellerOf = (s: string | null) => {
    if (!s) return null;
    const k = s.toLowerCase();
    return members.find((m) => m.email.toLowerCase() === k || m.name.toLowerCase() === k)?.userId ?? undefined;
  };

  const plan = parsed.items.map((it) => {
    const id = (it.taxId && byRut.get(it.taxId)) || (!it.taxId ? byName.get(it.name.toLowerCase()) : undefined) || null;
    const seller = sellerOf(it.seller);
    if (seller === undefined) errors.push({ row: it.row, message: `No encontré al vendedor "${it.seller}": el cliente queda sin vendedor.` });
    return { it, id, seller: seller ?? null };
  });
  const toCreate = plan.filter((p) => !p.id);
  const toUpdate = plan.filter((p) => p.id);

  if (dryRun) {
    return NextResponse.json({
      dryRun: true, create: toCreate.length, update: toUpdate.length, errors: errors.slice(0, 200),
      optIn: plan.filter((p) => p.it.whatsappOptIn).length,
      preview: plan.slice(0, 15).map((p) => ({ row: p.it.row, name: p.it.name, taxId: p.it.taxId, phone: p.it.phone, seller: p.it.seller, action: p.id ? "actualizar" : "crear" })),
    });
  }

  // El permiso de WhatsApp solo se ENCIENDE desde el archivo (nunca se quita): quitarlo es decisión del cliente, en el panel.
  const fields = (p: (typeof plan)[number]) => pick({
    name: p.it.name, contact_name: p.it.contactName, phone: p.it.phone, email: p.it.email, address: p.it.address, city: p.it.city,
    assigned_seller_id: p.seller,
    ...(p.it.whatsappOptIn ? { whatsapp_opt_in: true, whatsapp_opt_in_at: new Date().toISOString() } : {}),
  });
  for (let i = 0; i < toCreate.length; i += 500) {
    const chunk = toCreate.slice(i, i + 500);
    const { error } = await admin.from("company_customers")
      .insert(chunk.map((p) => ({ tenant_id: g.tenantId, tax_id: p.it.taxId, customer_type: p.it.customerType, ...fields(p) })));
    if (error) throw error;
  }
  await inBatches(toUpdate, 10, async (p) => {
    const { error } = await admin.from("company_customers").update(fields(p)).eq("tenant_id", g.tenantId).eq("id", p.id!);
    if (error) errors.push({ row: p.it.row, message: "No se pudo actualizar el cliente." });
  });
  return NextResponse.json({ dryRun: false, created: toCreate.length, updated: toUpdate.length, errors: errors.slice(0, 200) });
}
