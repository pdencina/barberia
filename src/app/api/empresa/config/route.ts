import { NextResponse } from "next/server";
import { badRequest, dbErrorResponse, isUuid, missingMigration, readJson } from "@/lib/empresas/errors";
import { requireCompany } from "@/lib/empresas/guard";
import { loadSettings } from "@/lib/empresas/settings";
import { createAdminSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const g = await requireCompany();
  if (!g.ok) return g.response;
  const { settings, missingMigration: missing } = await loadSettings(createAdminSupabase(), g.tenantId);
  return NextResponse.json({ settings, missingMigration: missing });
}

const INT_FIELDS: [string, string, number, number][] = [
  ["contactEveryDays", "contact_every_days", 1, 365],
  ["noAnswerRetryDays", "no_answer_retry_days", 0, 60],
  ["maxNoAnswerAttempts", "max_no_answer_attempts", 1, 20],
];
const BOOL_FIELDS: [string, string][] = [
  ["weeklyReportEnabled", "weekly_report_enabled"],
  ["portalEnabled", "portal_enabled"],
  ["portalShowPrices", "portal_show_prices"],
];

export async function PATCH(req: Request) {
  const g = await requireCompany("config.editar");
  if (!g.ok) return g.response;
  const body = await readJson(req);
  if (!body) return badRequest("No hay cambios.");
  const row: Record<string, unknown> = {};
  for (const [key, col, min, max] of INT_FIELDS) {
    if (body[key] === undefined) continue;
    const n = body[key];
    if (!Number.isInteger(n) || (n as number) < min || (n as number) > max) return badRequest(`Valor fuera de rango (${min} a ${max}).`);
    row[col] = n;
  }
  for (const [key, col] of BOOL_FIELDS) {
    if (body[key] === undefined) continue;
    if (typeof body[key] !== "boolean") return badRequest("Valor no válido.");
    row[col] = body[key];
  }
  if (body.portalStockMode !== undefined) {
    if (body.portalStockMode !== "availability" && body.portalStockMode !== "exact") return badRequest("Valor no válido.");
    row.portal_stock_mode = body.portalStockMode;
  }
  const admin = createAdminSupabase();
  if (body.portalWarehouseId !== undefined) {
    if (body.portalWarehouseId === null) row.portal_warehouse_id = null;
    else {
      if (!isUuid(body.portalWarehouseId)) return badRequest("Bodega no válida.");
      const { data: wh } = await admin.from("company_warehouses").select("id").eq("tenant_id", g.tenantId).eq("id", body.portalWarehouseId).eq("active", true).maybeSingle();
      if (!wh) return badRequest("Bodega no válida.");
      row.portal_warehouse_id = body.portalWarehouseId;
    }
  }
  if (Object.keys(row).length === 0) return badRequest("No hay cambios.");
  const { error } = await admin.from("company_settings").upsert({ tenant_id: g.tenantId, ...row }, { onConflict: "tenant_id" });
  if (error) return error.code === "42P01" || /does not exist|schema cache/i.test(error.message) ? missingMigration(158) : dbErrorResponse(error, "config PATCH");
  const { settings } = await loadSettings(admin, g.tenantId);
  return NextResponse.json({ settings });
}
