import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, getCurrentTenantId, resolveTenantForRequest } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const supabase = createAdminSupabase();
  const { searchParams } = new URL(req.url);
  // Never trust the tenantId coming from the browser — see resolveTenantForRequest.
  const { tenantId } = await resolveTenantForRequest(searchParams.get("tenantId"));

  // No tenant resolved = return nothing. This used to fall through and return EVERY
  // tenant's branches unfiltered.
  if (!tenantId) return NextResponse.json([]);

  let query = supabase
    .from("branches")
    .select("*")
    .eq("active", true)
    .order("name");

  if (tenantId !== "ALL") {
    query = query.eq("tenant_id", tenantId);
  }

  const { data } = await query;
  return NextResponse.json(data || []);
}

export async function POST(req: NextRequest) {
  const supabase = createAdminSupabase();
  const body = await req.json();
  const { name, slug, address, phone, email, open_time, close_time, tenantId } = body;

  // A branch MUST belong to a business. Before this, the insert left tenant_id NULL, so
  // the branch became an orphan visible/invisible inconsistently across businesses
  // (that's the phantom "Estudio Levels Puente Alto" Saray saw). Resolve from session.
  const { tenantId: resolvedTenant } = await resolveTenantForRequest(tenantId);
  const branchTenant = resolvedTenant && resolvedTenant !== "ALL"
    ? resolvedTenant
    : (resolvedTenant === "ALL" && tenantId ? tenantId : null);
  if (!branchTenant) {
    return NextResponse.json({ error: "No se pudo determinar el negocio para la sucursal." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("branches")
    .insert({
      name,
      slug: slug || name.toLowerCase().replace(/\s+/g, "-"),
      address,
      phone,
      email,
      open_time: open_time || "10:00",
      close_time: close_time || "21:00",
      tenant_id: branchTenant,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
