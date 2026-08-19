import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, getCurrentTenantId } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const supabase = createAdminSupabase();
  const { searchParams } = new URL(req.url);
  const includeInactive = searchParams.get("all") === "true";
  const tenantId = searchParams.get("tenantId") || await getCurrentTenantId();

  let query = supabase.from("services").select("*").order("sort_order", { ascending: true }).order("name");
  if (!includeInactive) {
    query = query.eq("active", true);
  }
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
  const { name, description, price, duration } = body;

  const { data, error } = await supabase
    .from("services")
    .insert({ name, description, price, duration })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
