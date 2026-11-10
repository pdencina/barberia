import { NextResponse } from "next/server";
import { fetchAllRows } from "@/lib/accounting";
import { badRequest, cleanText, dbErrorResponse, isUuid, missingMigration, readJson } from "@/lib/empresas/errors";
import { requireCompany } from "@/lib/empresas/guard";
import { FELIPE_TIERS, previousMonthRange, suggestTier, tierFromRow } from "@/lib/empresas/precios";
import { faltaMigracion } from "@/lib/empresas/settings";
import { createAdminSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Tramos de precio de la empresa y, para cada cliente distribuidor, sus compras del mes anterior y el tramo sugerido.
 * Compras = pedidos despachados o entregados en ese mes (precio guardado × cantidad).
 */
export async function GET() {
  const g = await requireCompany("config.editar");
  if (!g.ok) return g.response;
  const admin = createAdminSupabase();
  try {
    const { data, error } = await admin.from("company_price_tiers").select("*").eq("tenant_id", g.tenantId).order("sort").order("created_at");
    if (error) throw error;
    const tiers = (data || []).map(tierFromRow);

    const month = previousMonthRange(Date.now());
    const customers = await fetchAllRows(() => admin.from("company_customers").select("id, name, price_tier_id")
      .eq("tenant_id", g.tenantId).eq("active", true).eq("customer_type", "distributor")) as any[];
    const orders = await fetchAllRows(() => admin.from("company_orders").select("id, customer_id, items:company_order_items(quantity, unit_price)")
      .eq("tenant_id", g.tenantId).in("status", ["dispatched", "delivered"]).gte("dispatched_at", month.from).lt("dispatched_at", month.to)) as any[];
    const bought = new Map<string, number>();
    for (const o of orders) {
      const total = (o.items || []).reduce((s: number, i: any) => s + (Number(i.unit_price) || 0) * i.quantity, 0);
      bought.set(o.customer_id, (bought.get(o.customer_id) || 0) + total);
    }
    return NextResponse.json({
      tiers,
      defaults: tiers.length === 0 ? FELIPE_TIERS : null,
      month: month.label,
      distributors: customers.map((c) => {
        const amount = Math.round(bought.get(c.id) || 0);
        return { customerId: c.id, name: c.name, tierId: c.price_tier_id, lastMonth: amount, suggestedTierId: suggestTier(tiers, amount)?.id ?? null };
      }),
    });
  } catch (e: any) {
    if (faltaMigracion(e)) return missingMigration(161);
    return dbErrorResponse(e, "precios GET");
  }
}

/** Guarda la lista completa de tramos: crea los nuevos, actualiza los existentes y desactiva los que ya no vienen. */
export async function PUT(req: Request) {
  const g = await requireCompany("config.editar");
  if (!g.ok) return g.response;
  const body = await readJson(req);
  const list = Array.isArray(body?.tiers) ? (body!.tiers as any[]) : null;
  if (!list || list.length > 30) return badRequest("Revisa los tramos.");
  const rows: Record<string, unknown>[] = [];
  for (let i = 0; i < list.length; i++) {
    const t = list[i];
    const name = cleanText(t?.name, 80);
    const d = Number(t?.discountPct);
    const min = t?.minAmount === null || t?.minAmount === "" || t?.minAmount === undefined ? null : Number(t.minAmount);
    const max = t?.maxAmount === null || t?.maxAmount === "" || t?.maxAmount === undefined ? null : Number(t.maxAmount);
    if (!name) return badRequest(`Falta el nombre del tramo ${i + 1}.`);
    if (!Number.isFinite(d) || d < 0 || d > 90) return badRequest(`El descuento de "${name}" debe estar entre 0 y 90%.`);
    if ((min !== null && (!Number.isFinite(min) || min < 0)) || (max !== null && (!Number.isFinite(max) || max < 0))) return badRequest(`Revisa el rango de "${name}".`);
    if (min !== null && max !== null && max < min) return badRequest(`En "${name}" el máximo es menor que el mínimo.`);
    if (t?.id !== undefined && t?.id !== null && !isUuid(t.id)) return badRequest("Tramo no válido.");
    rows.push({ ...(t?.id ? { id: t.id } : {}), name, discount_pct: Math.round(d * 100) / 100, min_amount: min, max_amount: max, sort: i, active: true });
  }
  const admin = createAdminSupabase();
  try {
    const { data: existing, error } = await admin.from("company_price_tiers").select("id").eq("tenant_id", g.tenantId);
    if (error) throw error;
    const known = new Set((existing || []).map((x) => x.id));
    if (rows.some((r) => r.id && !known.has(r.id as string))) return badRequest("Tramo no válido.");
    for (const r of rows) {
      const { id, ...fields } = r as any;
      const q = id
        ? admin.from("company_price_tiers").update(fields).eq("tenant_id", g.tenantId).eq("id", id)
        : admin.from("company_price_tiers").insert({ tenant_id: g.tenantId, ...fields });
      const { error: e2 } = await q;
      if (e2) throw e2;
    }
    const keep = new Set(rows.filter((r) => r.id).map((r) => r.id as string));
    const drop = Array.from(known).filter((id) => !keep.has(id));
    if (drop.length) {
      const { error: e3 } = await admin.from("company_price_tiers").update({ active: false }).eq("tenant_id", g.tenantId).in("id", drop);
      if (e3) throw e3;
    }
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (faltaMigracion(e)) return missingMigration(161);
    return dbErrorResponse(e, "precios PUT");
  }
}
