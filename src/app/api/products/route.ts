import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, getCurrentTenantId } from "@/lib/supabase/server";

export async function GET() {
  const supabase = createAdminSupabase();
  const tenantId = await getCurrentTenantId();

  let query = supabase
    .from("products")
    .select("*")
    .eq("active", true)
    .order("name");

  if (tenantId) {
    query = query.eq("tenant_id", tenantId);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json([]);
  return NextResponse.json(data || []);
}

export async function POST(req: NextRequest) {
  const supabase = createAdminSupabase();
  const body = await req.json();
  const { name, description, sku, price, cost, stock, min_stock } = body;

  const { data, error } = await supabase
    .from("products")
    .insert({ name, description, sku, price, cost, stock, min_stock: min_stock || 5 })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
