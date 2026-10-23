import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, requireRole } from "@/lib/supabase/server";

// SEGURIDAD: antes editar y borrar cupones no pedia sesion ni comprobaba el negocio: cualquiera podia tocar los cupones de cualquier negocio.
// Solo el administrador (menu Cupones) y solo los cupones de su propio negocio; super admin con cualquiera.
async function authorizeCoupon(supabase: ReturnType<typeof createAdminSupabase>, id: string): Promise<NextResponse | null> {
  const g = await requireRole(["admin", "super_admin"]);
  if (!g.ok) return g.response;
  const { data: coupon } = await supabase.from("coupons").select("tenant_id").eq("id", id).maybeSingle();
  if (!coupon) return NextResponse.json({ error: "Cupon no encontrado" }, { status: 404 });
  if (g.role !== "super_admin" && coupon.tenant_id !== g.tenantId) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  return null;
}

// PATCH: update a coupon. (The coupons page already called this endpoint to edit, but
// it didn't exist, so editing silently did nothing — now it's implemented.)
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createAdminSupabase();
  const denied = await authorizeCoupon(supabase, params.id);
  if (denied) return denied;
  const body = await req.json();

  const update: Record<string, any> = {};
  if (body.description !== undefined) update.description = body.description;
  if (body.discount_type !== undefined) update.discount_type = body.discount_type;
  if (body.discount_value !== undefined) update.discount_value = body.discount_value;
  if (body.min_purchase !== undefined) update.min_purchase = body.min_purchase;
  if (body.max_uses !== undefined) update.max_uses = body.max_uses;
  if (body.valid_until !== undefined) update.valid_until = body.valid_until;
  if (body.active !== undefined) update.active = body.active;

  const { data, error } = await supabase
    .from("coupons")
    .update(update)
    .eq("id", params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// DELETE: remove a coupon.
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createAdminSupabase();
  const denied = await authorizeCoupon(supabase, params.id);
  if (denied) return denied;
  const { error } = await supabase.from("coupons").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
