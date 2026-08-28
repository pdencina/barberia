import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, getCurrentUserRoleAndTenant } from "@/lib/supabase/server";

export const maxDuration = 60; // Allow up to 60s for large batches

export async function POST(req: NextRequest) {
  const supabase = createAdminSupabase();

  // Bulk delete is highly destructive: only admin/super_admin, and always scoped to the
  // caller's own tenant so no one can wipe another salon's clients.
  const { userId, role, tenantId } = await getCurrentUserRoleAndTenant();
  if (!userId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!role || !["admin", "super_admin"].includes(role)) {
    return NextResponse.json({ error: "No tienes permisos para eliminar clientes" }, { status: 403 });
  }
  // Non super_admin must have a tenant, and all deletes are confined to it.
  if (role !== "super_admin" && !tenantId) {
    return NextResponse.json({ error: "Sin negocio asignado" }, { status: 403 });
  }
  const scopeTenant = role !== "super_admin";

  const { ids, deleteAll } = await req.json();

  let targetIds: string[] = [];

  if (deleteAll) {
    // Get ALL client IDs — scoped to the caller's tenant (never global for a tenant admin).
    let q = supabase.from("clients").select("id");
    if (scopeTenant) q = q.eq("tenant_id", tenantId);
    const { data: allClients } = await q;
    targetIds = (allClients || []).map((c) => c.id);
  } else {
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "ids required" }, { status: 400 });
    }
    // Restrict the provided ids to those that belong to the caller's tenant.
    if (scopeTenant) {
      const { data: owned } = await supabase
        .from("clients")
        .select("id")
        .in("id", ids)
        .eq("tenant_id", tenantId);
      targetIds = (owned || []).map((c) => c.id);
    } else {
      targetIds = ids;
    }
  }

  if (targetIds.length === 0) {
    return NextResponse.json({ success: true, deleted: 0 });
  }

  let deleted = 0;
  const batchSize = 50;

  for (let i = 0; i < targetIds.length; i += batchSize) {
    const batch = targetIds.slice(i, i + batchSize);

    // Delete related records first (respect foreign keys)
    await supabase.from("loyalty_points").delete().in("client_id", batch);

    const { data: appts } = await supabase.from("appointments").select("id").in("client_id", batch);
    if (appts && appts.length > 0) {
      const apptIds = appts.map((a) => a.id);
      await supabase.from("appointment_services").delete().in("appointment_id", apptIds);
      await supabase.from("reviews").delete().in("appointment_id", apptIds);
      await supabase.from("appointments").delete().in("client_id", batch);
    }

    await supabase.from("reviews").delete().in("client_id", batch);
    await supabase.from("transactions").update({ client_id: null }).in("client_id", batch);

    // Now delete clients
    const { error } = await supabase.from("clients").delete().in("id", batch);
    if (!error) deleted += batch.length;
  }

  return NextResponse.json({ success: true, deleted });
}
