import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, getCurrentTenantId } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const supabase = createAdminSupabase();
  const { searchParams } = new URL(req.url);
  let tenantId = searchParams.get("tenantId");
  if (!tenantId) tenantId = await getCurrentTenantId();

  let query = supabase
    .from("branches")
    .select("*")
    .eq("active", true)
    .order("name");

  if (tenantId && tenantId !== "ALL") {
    query = query.eq("tenant_id", tenantId);
  }

  const { data } = await query;
  return NextResponse.json(data || []);
}

export async function POST(req: NextRequest) {
  const supabase = createAdminSupabase();
  const body = await req.json();
  const { name, slug, address, phone, email, open_time, close_time } = body;

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
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
