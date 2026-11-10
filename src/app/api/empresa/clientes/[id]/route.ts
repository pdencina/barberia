import { NextResponse } from "next/server";
import { roleCan } from "@/lib/empresas/capabilities";
import { badRequest, cleanText, dbErrorResponse, isUuid, missingMigration, notFound, readJson } from "@/lib/empresas/errors";
import { requireCompany } from "@/lib/empresas/guard";
import { faltaMigracion } from "@/lib/empresas/settings";
import { createAdminSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const TEXT_FIELDS: [string, string, number][] = [
  ["name", "name", 200], ["contactName", "contact_name", 200], ["phone", "phone", 40], ["email", "email", 200],
  ["address", "address", 300], ["city", "city", 100],
];

// Editar un cliente comercial. El vendedor solo los de su cartera o sin vendedor, y no puede cambiar de vendedor.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const g = await requireCompany("clientes.editar");
  if (!g.ok) return g.response;
  if (!isUuid(params.id)) return notFound();
  const body = await readJson(req);
  if (!body) return badRequest("No hay cambios.");
  const admin = createAdminSupabase();
  const all = roleCan(g.role, "cartera.ver_todas");

  const { data: current, error: readError } = await admin.from("company_customers").select("id, assigned_seller_id, whatsapp_opt_in")
    .eq("tenant_id", g.tenantId).eq("id", params.id).maybeSingle();
  if (readError) return faltaMigracion(readError) ? missingMigration(158) : dbErrorResponse(readError, "cliente PATCH");
  if (!current || (!all && current.assigned_seller_id && current.assigned_seller_id !== g.userId)) return notFound();

  const update: Record<string, unknown> = {};
  for (const [key, col, max] of TEXT_FIELDS) {
    if (body[key] === undefined) continue;
    const v = cleanText(body[key], max);
    if (key === "name" && !v) return badRequest("Escribe el nombre del cliente.");
    update[col] = v;
  }
  if (body.taxId !== undefined) update.tax_id = cleanText(body.taxId, 20);
  if (body.customerType !== undefined) update.customer_type = body.customerType === "distributor" ? "distributor" : "client";
  if (body.active !== undefined) {
    if (typeof body.active !== "boolean") return badRequest("Valor no válido.");
    update.active = body.active;
  }
  if (body.whatsappOptIn !== undefined) {
    if (typeof body.whatsappOptIn !== "boolean") return badRequest("Valor no válido.");
    update.whatsapp_opt_in = body.whatsappOptIn;
    if (body.whatsappOptIn && !current.whatsapp_opt_in) update.whatsapp_opt_in_at = new Date().toISOString();
  }
  if (body.sellerId !== undefined) {
    if (!roleCan(g.role, "cartera.asignar")) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    if (body.sellerId !== null) {
      if (!isUuid(body.sellerId)) return badRequest("Elige un vendedor.");
      const { data: m } = await admin.from("company_members").select("role_key").eq("tenant_id", g.tenantId).eq("user_id", body.sellerId).eq("active", true).maybeSingle();
      if (!m || (m.role_key !== "seller" && m.role_key !== "owner")) return badRequest("Ese vendedor no existe o no está activo.");
    }
    update.assigned_seller_id = body.sellerId;
  }
  if (body.priceTierId !== undefined) {
    if (!roleCan(g.role, "config.editar")) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    if (body.priceTierId !== null) {
      if (!isUuid(body.priceTierId)) return badRequest("Elige un tramo.");
      const { data: tier, error: tierError } = await admin.from("company_price_tiers").select("id").eq("tenant_id", g.tenantId).eq("id", body.priceTierId).eq("active", true).maybeSingle();
      if (tierError) return faltaMigracion(tierError) ? missingMigration(161) : dbErrorResponse(tierError, "cliente PATCH tramo");
      if (!tier) return badRequest("Ese tramo no existe.");
    }
    update.price_tier_id = body.priceTierId;
  }
  if (Object.keys(update).length === 0) return badRequest("No hay cambios.");
  const { error } = await admin.from("company_customers").update(update).eq("tenant_id", g.tenantId).eq("id", params.id);
  if (error) return faltaMigracion(error) ? missingMigration(update.price_tier_id !== undefined ? 161 : 160) : dbErrorResponse(error, "cliente PATCH");
  return NextResponse.json({ ok: true });
}
