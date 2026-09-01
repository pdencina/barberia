import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, getCurrentTenantId, resolveTenantForRequest } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const supabase = createAdminSupabase();
  const { searchParams } = new URL(req.url);
  // Never trust the tenantId coming from the browser — see resolveTenantForRequest.
  const { tenantId } = await resolveTenantForRequest(searchParams.get("tenantId"));

  // If no tenant, return empty (except super_admin)
  if (!tenantId) {
    return NextResponse.json([]);
  }

  let query = supabase
    .from("products")
    .select("*")
    .eq("active", true)
    .order("name");

  if (tenantId !== "ALL") {
    query = query.eq("tenant_id", tenantId);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json([]);
  return NextResponse.json(data || []);
}

export async function POST(req: NextRequest) {
  const supabase = createAdminSupabase();
  const body = await req.json();
  const { name, description, sku, price, cost, stock, min_stock, tenantId } = body;

  // Resolve tenant
  let resolvedTenantId = tenantId;
  if (!resolvedTenantId) {
    resolvedTenantId = await getCurrentTenantId();
    if (resolvedTenantId === "ALL") resolvedTenantId = null;
  }

  // A product without a tenant_id is invisible everywhere (the GET filters by tenant),
  // which looks like "the product wasn't created". Fail loudly instead of saving an orphan.
  if (!resolvedTenantId) {
    return NextResponse.json(
      { error: "No se pudo determinar el negocio para el producto. Recarga la pagina e intenta de nuevo." },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("products")
    .insert({ name, description, sku, price, cost, stock, min_stock: min_stock || 5, tenant_id: resolvedTenantId })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
