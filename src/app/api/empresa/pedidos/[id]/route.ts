import { NextResponse } from "next/server";
import { canSeeOrder, roleCan, type Capability } from "@/lib/empresas/capabilities";
import { badRequest, cleanText, dbErrorResponse, isUuid, notFound, readJson } from "@/lib/empresas/errors";
import { requireCompany } from "@/lib/empresas/guard";
import { faltaMigracion } from "@/lib/empresas/settings";
import { createAdminSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const ACTION_CAPABILITY: Record<string, Capability> = {
  confirm: "pedidos.confirmar",
  prepare: "pedidos.preparar",
  dispatch: "pedidos.despachar",
  deliver: "pedidos.entregar",
  cancel: "pedidos.cancelar",
};

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const g = await requireCompany();
  if (!g.ok) return g.response;
  if (!isUuid(params.id)) return notFound();
  const cols = "id, status, notes, created_by, created_at, confirmed_at, prepared_at, dispatched_at, delivered_at, cancelled_at, cancel_reason, warehouse:company_warehouses(name), items:company_order_items(product_id, quantity, unit_price, product:company_products(name, sku))";
  const read = (extra: string) => createAdminSupabase().from("company_orders").select(`${cols}, ${extra}`)
    .eq("id", params.id).eq("tenant_id", g.tenantId).maybeSingle();
  let { data, error } = await read("source, customer:company_customers(name, assigned_seller_id)");
  if (error && faltaMigracion(error)) ({ data, error } = await read("customer:company_customers(name)"));
  if (error) return dbErrorResponse(error, "pedido GET");
  const order = data as any;
  if (!order || !canSeeOrder(g.role, g.userId, { ...order, assignedSellerId: order.customer?.assigned_seller_id })) return notFound();
  return NextResponse.json({ order });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const g = await requireCompany();
  if (!g.ok) return g.response;
  if (!isUuid(params.id)) return notFound();
  const body = await readJson(req);
  const action = typeof body?.action === "string" ? body.action : "";
  if (!Object.prototype.hasOwnProperty.call(ACTION_CAPABILITY, action)) return badRequest("La acción no es válida.");

  const admin = createAdminSupabase();
  let { data: order, error: readError } = await admin.from("company_orders").select("created_by, status, customer:company_customers(assigned_seller_id)")
    .eq("id", params.id).eq("tenant_id", g.tenantId).maybeSingle() as { data: any; error: any };
  if (readError && faltaMigracion(readError)) ({ data: order, error: readError } = await admin.from("company_orders").select("created_by, status").eq("id", params.id).eq("tenant_id", g.tenantId).maybeSingle());
  if (readError) return dbErrorResponse(readError, "pedido acción");
  if (!order || !canSeeOrder(g.role, g.userId, { ...order, assignedSellerId: order.customer?.assigned_seller_id })) return notFound();
  if (!roleCan(g.role, ACTION_CAPABILITY[action])) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const args = { p_tenant_id: g.tenantId, p_order_id: params.id, p_user_id: g.userId };
  const { data, error } =
    action === "confirm" ? await admin.rpc("company_order_confirm", args)
    : action === "dispatch" ? await admin.rpc("company_order_dispatch", args)
    : action === "cancel" ? await admin.rpc("company_order_cancel", { ...args, p_reason: cleanText(body?.reason, 500) })
    : await admin.rpc("company_order_advance", { ...args, p_to: action === "prepare" ? "prepared" : "delivered" });
  if (error) return dbErrorResponse(error, `pedido ${action}`);
  return NextResponse.json({ status: data?.status, replayed: data?.replayed === true });
}
