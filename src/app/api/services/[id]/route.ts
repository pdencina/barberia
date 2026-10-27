import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";
import { authorizeServiceAccess } from "@/lib/service-access";

// Solo estos campos se pueden editar desde aqui (antes se aplicaba todo el cuerpo, incluido tenant_id).
const EDITABLE = ["name", "description", "price", "duration", "category", "active", "sort_order"] as const;

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await authorizeServiceAccess(params.id);
  if (!auth.ok) return auth.response;

  const supabase = createAdminSupabase();
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch {}

  const update: Record<string, unknown> = {};
  for (const k of EDITABLE) if (body && body[k] !== undefined) update[k] = body[k];
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No hay campos validos para actualizar" }, { status: 400 });
  }

  // If price is being changed, log it
  if (update.price !== undefined && Number(auth.service.price) !== Number(update.price)) {
    await supabase.from("price_history").insert({
      entity_type: "service",
      entity_id: params.id,
      entity_name: auth.service.name,
      old_price: Number(auth.service.price),
      new_price: Number(update.price),
    });
  }

  const { data, error } = await supabase
    .from("services")
    .update(update)
    .eq("id", params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await authorizeServiceAccess(params.id);
  if (!auth.ok) return auth.response;

  const supabase = createAdminSupabase();
  const { error } = await supabase
    .from("services")
    .update({ active: false })
    .eq("id", params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
