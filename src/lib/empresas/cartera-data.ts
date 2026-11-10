import { fetchAllRows } from "@/lib/accounting";
import type { createAdminSupabase } from "@/lib/supabase/server";
import type { Activity, ActivityResult, QueueCustomer } from "@/lib/empresas/cartera";

type Admin = ReturnType<typeof createAdminSupabase>;

/**
 * Lee clientes activos y su historial (gestiones + pedidos no cancelados, que cuentan como "vendió").
 * sellerId: solo la cartera de ese vendedor. sinceMs: limita el historial (el reporte no necesita todo).
 */
export async function loadCartera(admin: Admin, tenantId: string, opts: { sellerId?: string; sinceMs?: number } = {}) {
  const customers = await fetchAllRows(() => {
    let q = admin.from("company_customers").select("id, name, created_at, assigned_seller_id")
      .eq("tenant_id", tenantId).eq("active", true);
    if (opts.sellerId) q = q.eq("assigned_seller_id", opts.sellerId);
    return q.order("name");
  }) as { id: string; name: string; created_at: string; assigned_seller_id: string | null }[];

  const ids = new Set(customers.map((c) => c.id));
  const since = opts.sinceMs ? new Date(opts.sinceMs).toISOString() : null;

  const acts = await fetchAllRows(() => {
    let q = admin.from("company_customer_activities").select("id, customer_id, seller_id, result, callback_on, created_at").eq("tenant_id", tenantId);
    if (since) q = q.gte("created_at", since);
    return q.order("created_at");
  }) as { customer_id: string; seller_id: string; result: ActivityResult; callback_on: string | null; created_at: string }[];

  const orders = await fetchAllRows(() => {
    let q = admin.from("company_orders").select("id, customer_id, created_by, created_at, source").eq("tenant_id", tenantId).neq("status", "cancelled");
    if (since) q = q.gte("created_at", since);
    return q.order("created_at");
  }) as { customer_id: string; created_by: string; created_at: string; source?: string }[];

  const activities: Activity[] = [
    ...acts.filter((a) => ids.has(a.customer_id)).map((a) => ({
      customerId: a.customer_id, sellerId: a.seller_id, result: a.result, createdAt: a.created_at, callbackOn: a.callback_on,
    })),
    ...orders.filter((o) => ids.has(o.customer_id)).map((o) => ({
      customerId: o.customer_id, sellerId: o.created_by, result: "sold" as const, createdAt: o.created_at,
    })),
  ];
  const queueCustomers: QueueCustomer[] = customers.map((c) => ({ id: c.id, name: c.name, createdAt: c.created_at, assignedSellerId: c.assigned_seller_id }));
  return { customers: queueCustomers, activities };
}

/** Nombre y correo de los miembros activos de la empresa (para mostrar vendedores y avisar). */
export async function loadMembers(admin: Admin, tenantId: string) {
  const { data, error } = await admin.from("company_members").select("user_id, role_key, active, profile:profiles!user_id(name, email)")
    .eq("tenant_id", tenantId);
  if (error) throw error;
  return (data || []).map((m: any) => ({
    userId: m.user_id as string,
    role: m.role_key as string,
    active: m.active as boolean,
    name: (m.profile?.name as string) || "",
    email: (m.profile?.email as string) || "",
  }));
}
