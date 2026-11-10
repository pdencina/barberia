import { NextResponse } from "next/server";
import { roleCan } from "@/lib/empresas/capabilities";
import { buildQueue, type ActivityResult } from "@/lib/empresas/cartera";
import { loadCartera } from "@/lib/empresas/cartera-data";
import { badRequest, cleanText, dbErrorResponse, isUuid, missingMigration, notFound, readJson } from "@/lib/empresas/errors";
import { requireCompany } from "@/lib/empresas/guard";
import { faltaMigracion, loadSettings } from "@/lib/empresas/settings";
import { createAdminSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const RESULTS: ActivityResult[] = ["sold", "no_answer", "callback", "not_interested", "skipped"];

// Un vendedor ve (y gestiona) los clientes de su cartera y los que no tienen vendedor. El dueño, todos.
async function visibleCustomer(admin: ReturnType<typeof createAdminSupabase>, g: { tenantId: string; userId: string; role: string }, customerId: string) {
  const { data, error } = await admin.from("company_customers").select("id, name, assigned_seller_id")
    .eq("tenant_id", g.tenantId).eq("id", customerId).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  if (roleCan(g.role, "cartera.ver_todas")) return data;
  return !data.assigned_seller_id || data.assigned_seller_id === g.userId ? data : null;
}

export async function GET(req: Request) {
  const g = await requireCompany("clientes.ver");
  if (!g.ok) return g.response;
  const customerId = new URL(req.url).searchParams.get("customerId");
  if (!isUuid(customerId)) return badRequest("Falta el cliente.");
  const admin = createAdminSupabase();
  try {
    if (!(await visibleCustomer(admin, g, customerId))) return notFound();
    const { data, error } = await admin.from("company_customer_activities")
      .select("id, result, notes, skip_reason, callback_on, seller_id, created_at")
      .eq("tenant_id", g.tenantId).eq("customer_id", customerId).order("created_at", { ascending: false }).limit(100);
    if (error) throw error;
    return NextResponse.json({ activities: data });
  } catch (e: any) {
    if (faltaMigracion(e)) return missingMigration(158);
    return dbErrorResponse(e, "gestiones GET");
  }
}

/**
 * Anota el resultado de un llamado. Cola obligatoria: si el cliente está en la cola del vendedor, solo se acepta el primero
 * (no se puede pasar a otro sin resolverlo; saltarlo exige motivo). Un cliente que no está en la cola (llamó él, por ejemplo)
 * se puede anotar igual. El dueño puede anotar en cualquier cliente: así destraba a un vendedor.
 */
export async function POST(req: Request) {
  const g = await requireCompany("gestiones.registrar");
  if (!g.ok) return g.response;
  const body = await readJson(req);
  const customerId = body?.customerId;
  const result = body?.result as ActivityResult;
  if (!isUuid(customerId)) return badRequest("Falta el cliente.");
  if (!RESULTS.includes(result)) return badRequest("Elige el resultado.");
  const notes = cleanText(body?.notes, 1000);
  const skipReason = cleanText(body?.skipReason, 500);
  if (result === "skipped" && !skipReason) return badRequest("Para saltar un cliente escribe el motivo.");
  let callbackOn: string | null = null;
  if (result === "callback") {
    const d = typeof body?.callbackOn === "string" ? body.callbackOn : "";
    const t = Date.parse(`${d}T12:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || !Number.isFinite(t) || t < Date.now() - 36 * 3600e3 || t > Date.now() + 366 * 86400e3) {
      return badRequest("Elige una fecha para volver a llamar.");
    }
    callbackOn = d;
  }

  const admin = createAdminSupabase();
  try {
    const customer = await visibleCustomer(admin, g, customerId);
    if (!customer) return notFound();
    if (!roleCan(g.role, "cartera.ver_todas")) {
      const { settings, missingMigration: missing } = await loadSettings(admin, g.tenantId);
      if (missing) return missingMigration(158);
      const { customers, activities } = await loadCartera(admin, g.tenantId, { sellerId: g.userId });
      const queue = buildQueue(customers, activities, settings, Date.now());
      const inQueue = queue.some((q) => q.customerId === customerId);
      if (inQueue && queue[0].customerId !== customerId) {
        return NextResponse.json({ error: `Primero resuelve a ${queue[0].name}.`, code: "queue_locked", currentCustomerId: queue[0].customerId }, { status: 409 });
      }
    }
    const { data, error } = await admin.from("company_customer_activities").insert({
      tenant_id: g.tenantId, customer_id: customerId, seller_id: g.userId, result,
      callback_on: callbackOn, notes, skip_reason: result === "skipped" ? skipReason : null,
    }).select("id, result, created_at").single();
    if (error) throw error;
    return NextResponse.json({ activity: data }, { status: 201 });
  } catch (e: any) {
    if (faltaMigracion(e)) return missingMigration(158);
    return dbErrorResponse(e, "gestiones POST");
  }
}
