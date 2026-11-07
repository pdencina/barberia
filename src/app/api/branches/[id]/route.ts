import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, requireRole, resolveTenantForRequest } from "@/lib/supabase/server";
import { puedeCrearSucursal, MENSAJE_SIN_SUCURSALES } from "@/lib/branch-limit";

// Campos que se pueden editar de una sucursal (nunca el negocio dueño ni otros datos internos).
const EDITABLES = ["name", "slug", "address", "phone", "email", "open_time", "close_time", "active"];

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const guard = await requireRole(["admin", "super_admin"]);
  if (!guard.ok) return guard.response;
  const supabase = createAdminSupabase();
  const body = await req.json();

  // Scope the update to the caller's business — without the tenant filter, anyone could
  // edit another salon's branch by guessing its id. Never let tenant_id be overwritten
  // from the body.
  const { tenantId } = await resolveTenantForRequest(body.tenantId);
  if (!tenantId) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  // Solo campos conocidos: antes se guardaba cualquier cosa que viniera en el cuerpo (incluido otro tenant_id).
  const updates: Record<string, any> = {};
  for (const k of EDITABLES) if (body[k] !== undefined) updates[k] = body[k];
  // Volver a activar una sucursal también cuenta contra el límite del plan.
  if (updates.active === true && tenantId !== "ALL" && guard.role !== "super_admin") {
    const { data: actual } = await supabase.from("branches").select("active").eq("id", params.id).eq("tenant_id", tenantId).maybeSingle();
    if (actual && !actual.active) {
      const lim = await puedeCrearSucursal(supabase, tenantId);
      if (!lim.ok) return NextResponse.json({ error: MENSAJE_SIN_SUCURSALES, code: "plan_limit" }, { status: 403 });
    }
  }

  let q = supabase.from("branches").update(updates).eq("id", params.id);
  if (tenantId !== "ALL") q = q.eq("tenant_id", tenantId);

  const { data, error } = await q.select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const guard = await requireRole(["admin", "super_admin"]);
  if (!guard.ok) return guard.response;
  const supabase = createAdminSupabase();
  const { searchParams } = new URL(req.url);

  const { tenantId } = await resolveTenantForRequest(searchParams.get("tenantId"));
  if (!tenantId) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  let q = supabase.from("branches").update({ active: false }).eq("id", params.id);
  if (tenantId !== "ALL") q = q.eq("tenant_id", tenantId);

  await q;
  return NextResponse.json({ success: true });
}
