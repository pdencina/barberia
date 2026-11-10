import { NextResponse } from "next/server";
import { roleCan } from "@/lib/empresas/capabilities";
import { buildQueue, nextDueAt } from "@/lib/empresas/cartera";
import { loadCartera, loadMembers } from "@/lib/empresas/cartera-data";
import { badRequest, dbErrorResponse, isUuid, missingMigration, readJson } from "@/lib/empresas/errors";
import { requireCompany } from "@/lib/empresas/guard";
import { faltaMigracion, loadSettings } from "@/lib/empresas/settings";
import { createAdminSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Vendedor: su cola (los clientes de su cartera que ya tocan) y el cliente actual, con sus datos de contacto.
 * Dueño: resumen por vendedor y la lista completa con el vendedor y cuándo toca cada cliente. ?sellerId= muestra la cola de uno.
 */
export async function GET(req: Request) {
  const g = await requireCompany();
  if (!g.ok) return g.response;
  const all = roleCan(g.role, "cartera.ver_todas");
  if (!all && !roleCan(g.role, "gestiones.registrar")) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const admin = createAdminSupabase();
  const now = Date.now();
  try {
    const { settings, missingMigration: missing } = await loadSettings(admin, g.tenantId);
    if (missing) return missingMigration(158);
    const sellerParam = new URL(req.url).searchParams.get("sellerId");
    const sellerId = all ? (isUuid(sellerParam) ? sellerParam : null) : g.userId;

    if (sellerId) {
      const { customers, activities } = await loadCartera(admin, g.tenantId, { sellerId });
      const queue = buildQueue(customers, activities, settings, now);
      let current = null;
      if (queue[0]) {
        const { data } = await admin.from("company_customers").select("id, name, contact_name, phone, email, address, city, customer_type")
          .eq("tenant_id", g.tenantId).eq("id", queue[0].customerId).maybeSingle();
        const { data: history } = await admin.from("company_customer_activities").select("result, notes, callback_on, created_at")
          .eq("tenant_id", g.tenantId).eq("customer_id", queue[0].customerId).order("created_at", { ascending: false }).limit(5);
        current = { ...queue[0], customer: data, history: history || [] };
      }
      return NextResponse.json({ sellerId, portfolio: customers.length, queue: queue.map(({ customerId, name, dueAt, lastResult }) => ({ customerId, name, dueAt, lastResult })), current, settings });
    }

    const { customers, activities } = await loadCartera(admin, g.tenantId);
    const members = (await loadMembers(admin, g.tenantId)).filter((m) => m.active && (m.role === "seller" || m.role === "owner"));
    const byCustomer = new Map<string, typeof activities>();
    for (const a of activities) byCustomer.set(a.customerId, [...(byCustomer.get(a.customerId) || []), a]);
    const list = customers.map((c) => ({
      customerId: c.id, name: c.name, sellerId: c.assignedSellerId,
      dueAt: nextDueAt(byCustomer.get(c.id) || [], settings, c.createdAt),
    }));
    return NextResponse.json({
      sellers: members.map((m) => ({
        userId: m.userId, name: m.name || m.email, role: m.role,
        portfolio: list.filter((c) => c.sellerId === m.userId).length,
        pending: list.filter((c) => c.sellerId === m.userId && c.dueAt <= now).length,
      })),
      unassigned: list.filter((c) => !c.sellerId).length,
      customers: list,
      settings,
    });
  } catch (e: any) {
    if (faltaMigracion(e)) return missingMigration(158);
    return dbErrorResponse(e, "cartera GET");
  }
}

// El dueño asigna (o quita, con sellerId null) un grupo de clientes a un vendedor.
export async function POST(req: Request) {
  const g = await requireCompany("cartera.asignar");
  if (!g.ok) return g.response;
  const body = await readJson(req);
  const ids = Array.isArray(body?.customerIds) ? (body!.customerIds as unknown[]) : [];
  if (ids.length === 0 || ids.length > 5000 || !ids.every(isUuid)) return badRequest("Elige clientes.");
  const sellerId = body?.sellerId ?? null;
  const admin = createAdminSupabase();
  if (sellerId !== null) {
    if (!isUuid(sellerId)) return badRequest("Elige un vendedor.");
    const { data: m } = await admin.from("company_members").select("role_key").eq("tenant_id", g.tenantId).eq("user_id", sellerId).eq("active", true).maybeSingle();
    if (!m || (m.role_key !== "seller" && m.role_key !== "owner")) return badRequest("Ese vendedor no existe o no está activo.");
  }
  let updated = 0;
  for (let i = 0; i < ids.length; i += 500) {
    const { data, error } = await admin.from("company_customers").update({ assigned_seller_id: sellerId })
      .eq("tenant_id", g.tenantId).in("id", ids.slice(i, i + 500) as string[]).select("id");
    if (error) return faltaMigracion(error) ? missingMigration(158) : dbErrorResponse(error, "cartera POST");
    updated += data?.length || 0;
  }
  return NextResponse.json({ updated });
}
