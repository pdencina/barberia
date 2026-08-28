import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";
import { getTenantFromRequest } from "@/lib/tenant-filter";

// POST: Create a reward
export async function POST(req: NextRequest) {
  const supabase = createAdminSupabase();
  const body = await req.json();
  const { name, points_required, discount_value, description } = body;

  // Resolve tenant: prefer explicit param, fallback to session.
  let tenantId: string | null = body.tenantId || null;
  if (!tenantId) {
    const resolved = await getTenantFromRequest(req);
    tenantId = resolved && resolved !== "ALL" ? resolved : null;
  }
  if (!tenantId) {
    return NextResponse.json({ error: "No se pudo determinar el negocio para la recompensa." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("loyalty_rewards")
    .insert({
      name,
      points_required: points_required || 100,
      discount_value: discount_value || 0,
      description: description || name,
      active: true,
      tenant_id: tenantId,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// DELETE: Deactivate a reward
export async function DELETE(req: NextRequest) {
  const supabase = createAdminSupabase();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  await supabase.from("loyalty_rewards").update({ active: false }).eq("id", id);
  return NextResponse.json({ success: true });
}
