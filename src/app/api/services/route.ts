import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, getCurrentTenantId, resolveTenantForRequest } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const supabase = createAdminSupabase();
  const { searchParams } = new URL(req.url);
  const includeInactive = searchParams.get("all") === "true";
  // Never trust the tenantId coming from the browser — see resolveTenantForRequest.
  const { tenantId } = await resolveTenantForRequest(searchParams.get("tenantId"));

  // If no tenant, return empty (except super_admin = "ALL")
  if (!tenantId) {
    return NextResponse.json([]);
  }

  let query = supabase.from("services").select("*").order("sort_order", { ascending: true }).order("name");
  if (tenantId !== "ALL") {
    query = query.eq("tenant_id", tenantId);
  }
  if (!includeInactive) {
    query = query.eq("active", true);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json([]);
  return NextResponse.json(data || []);
}

export async function POST(req: NextRequest) {
  const supabase = createAdminSupabase();
  const body = await req.json();
  const { name, description, price, duration, sort_order, category, tenantId } = body;
  const tid = tenantId || await getCurrentTenantId();

  const { data, error } = await supabase
    .from("services")
    .insert({ name, description, price, duration, sort_order: sort_order || 0, category: category || null, tenant_id: tid })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
