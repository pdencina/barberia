import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, resolveTenantForRequest } from "@/lib/supabase/server";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createAdminSupabase();
  const body = await req.json();

  // Scope the update to the caller's business — without the tenant filter, anyone could
  // edit another salon's branch by guessing its id. Never let tenant_id be overwritten
  // from the body.
  const { tenantId } = await resolveTenantForRequest(body.tenantId);
  if (!tenantId) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const { tenantId: _drop, ...updates } = body;

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
  const supabase = createAdminSupabase();
  const { searchParams } = new URL(req.url);

  const { tenantId } = await resolveTenantForRequest(searchParams.get("tenantId"));
  if (!tenantId) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  let q = supabase.from("branches").update({ active: false }).eq("id", params.id);
  if (tenantId !== "ALL") q = q.eq("tenant_id", tenantId);

  await q;
  return NextResponse.json({ success: true });
}
