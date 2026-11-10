import { NextResponse } from "next/server";
import { isEmpresasEnabled } from "@/lib/empresas/flag";
import { faltaMigracion, loadSettings, type CompanySettings } from "@/lib/empresas/settings";
import { createAdminSupabase, createServerSupabase } from "@/lib/supabase/server";

export type PartnerContext = {
  userId: string;
  tenantId: string;
  tenantName: string;
  customerId: string;
  customerName: string;
  settings: CompanySettings;
};

export type PartnerLookup =
  | { state: "off" | "anon" | "not_partner" | "portal_closed" | "suspended" | "missing_migration" | "error" }
  | { state: "ok"; context: PartnerContext };

/**
 * Portal de distribuidores: sesión validada con Supabase Auth + acceso activo en company_partner_users + cliente distribuidor
 * activo + empresa con el portal encendido. Todo se lee en el servidor; el navegador no elige empresa ni cliente.
 */
export async function loadPartnerContext(): Promise<PartnerLookup> {
  if (!isEmpresasEnabled()) return { state: "off" };
  try {
    const { data: { user } } = await createServerSupabase().auth.getUser();
    if (!user) return { state: "anon" };
    const admin = createAdminSupabase();
    const { data: link, error } = await admin.from("company_partner_users").select("tenant_id, customer_id, active")
      .eq("user_id", user.id).maybeSingle();
    if (faltaMigracion(error)) return { state: "missing_migration" };
    if (error) return { state: "error" };
    if (!link || !link.active) return { state: "not_partner" };

    const { data: customer } = await admin.from("company_customers").select("name, customer_type, active")
      .eq("tenant_id", link.tenant_id).eq("id", link.customer_id).maybeSingle();
    if (!customer || !customer.active || customer.customer_type !== "distributor") return { state: "not_partner" };
    const { data: tenant } = await admin.from("tenants").select("name, kind, status").eq("id", link.tenant_id).maybeSingle();
    if (tenant?.kind !== "company") return { state: "not_partner" };
    if (tenant.status === "suspended") return { state: "suspended" };
    const { settings, missingMigration } = await loadSettings(admin, link.tenant_id);
    if (missingMigration) return { state: "missing_migration" };
    if (!settings.portalEnabled) return { state: "portal_closed" };
    return {
      state: "ok",
      context: { userId: user.id, tenantId: link.tenant_id, tenantName: tenant.name, customerId: link.customer_id, customerName: customer.name, settings },
    };
  } catch {
    return { state: "error" };
  }
}

const json = (error: string, status: number) => NextResponse.json({ error }, { status });

export async function requirePartner(): Promise<{ ok: false; response: NextResponse } | ({ ok: true } & PartnerContext)> {
  const found = await loadPartnerContext();
  switch (found.state) {
    case "off": return { ok: false, response: json("No encontrado", 404) };
    case "anon": return { ok: false, response: json("No autenticado", 401) };
    case "not_partner": return { ok: false, response: json("No autorizado", 403) };
    case "portal_closed": return { ok: false, response: json("El portal de distribuidores no está disponible por ahora.", 403) };
    case "suspended": return { ok: false, response: json("El portal no está disponible.", 402) };
    case "missing_migration": return { ok: false, response: json("Falta aplicar la migración 159.", 503) };
    case "error": return { ok: false, response: json("Error interno", 500) };
  }
  return { ok: true, ...found.context };
}

/** Bodega desde la que el portal muestra stock y arma pedidos: la elegida en la configuración, o la primera activa. */
export async function portalWarehouse(admin: ReturnType<typeof createAdminSupabase>, tenantId: string, chosen: string | null): Promise<string | null> {
  if (chosen) {
    const { data } = await admin.from("company_warehouses").select("id").eq("tenant_id", tenantId).eq("id", chosen).eq("active", true).maybeSingle();
    if (data) return data.id;
  }
  const { data } = await admin.from("company_warehouses").select("id").eq("tenant_id", tenantId).eq("active", true).order("created_at").limit(1).maybeSingle();
  return data?.id ?? null;
}

// Lo que ve el distribuidor del stock: con "availability" solo disponible/agotado; con "exact", la cantidad.
export function stockView(available: number, mode: CompanySettings["portalStockMode"]) {
  const n = Math.max(0, available);
  return mode === "exact" ? { available: n, inStock: n > 0 } : { inStock: n > 0 };
}
