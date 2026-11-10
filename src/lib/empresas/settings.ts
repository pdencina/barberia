import type { createAdminSupabase } from "@/lib/supabase/server";
import type { CarteraSettings } from "@/lib/empresas/cartera";

type Admin = ReturnType<typeof createAdminSupabase>;

export type CompanySettings = CarteraSettings & {
  weeklyReportEnabled: boolean;
  portalEnabled: boolean;
  portalStockMode: "availability" | "exact";
  portalShowPrices: boolean;
  portalWarehouseId: string | null;
};

// Los mismos valores por defecto de la migración 158: todo lo que envía o abre algo hacia afuera viene apagado.
export const DEFAULT_SETTINGS: CompanySettings = {
  contactEveryDays: 30,
  noAnswerRetryDays: 2,
  maxNoAnswerAttempts: 3,
  weeklyReportEnabled: false,
  portalEnabled: false,
  portalStockMode: "availability",
  portalShowPrices: true,
  portalWarehouseId: null,
};

export const faltaMigracion = (e: { code?: string; message?: string } | null | undefined) =>
  !!e && (e.code === "42P01" || e.code === "42703" || e.code === "PGRST205" || e.code === "PGRST204" || /does not exist|schema cache/i.test(e.message || ""));

export function settingsFromRow(row: any): CompanySettings {
  if (!row) return { ...DEFAULT_SETTINGS };
  return {
    contactEveryDays: row.contact_every_days ?? DEFAULT_SETTINGS.contactEveryDays,
    noAnswerRetryDays: row.no_answer_retry_days ?? DEFAULT_SETTINGS.noAnswerRetryDays,
    maxNoAnswerAttempts: row.max_no_answer_attempts ?? DEFAULT_SETTINGS.maxNoAnswerAttempts,
    weeklyReportEnabled: row.weekly_report_enabled === true,
    portalEnabled: row.portal_enabled === true,
    portalStockMode: row.portal_stock_mode === "exact" ? "exact" : "availability",
    portalShowPrices: row.portal_show_prices !== false,
    portalWarehouseId: row.portal_warehouse_id ?? null,
  };
}

/** Configuración de la empresa. Sin fila (o sin la migración 158) devuelve los valores por defecto. */
export async function loadSettings(admin: Admin, tenantId: string): Promise<{ settings: CompanySettings; missingMigration: boolean }> {
  const { data, error } = await admin.from("company_settings").select("*").eq("tenant_id", tenantId).maybeSingle();
  if (error) return { settings: { ...DEFAULT_SETTINGS }, missingMigration: faltaMigracion(error) };
  return { settings: settingsFromRow(data), missingMigration: false };
}
