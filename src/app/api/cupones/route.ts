import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, getCurrentTenantId } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const supabase = createAdminSupabase();
  const { searchParams } = new URL(req.url);
  let tenantId = searchParams.get("tenantId");
  if (!tenantId) tenantId = await getCurrentTenantId();

  let query = supabase
    .from("coupons")
    .select("*")
    .order("created_at", { ascending: false });

  if (tenantId && tenantId !== "ALL") {
    query = query.eq("tenant_id", tenantId);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json([]);
  return NextResponse.json(data || []);
}

export async function POST(req: NextRequest) {
  const supabase = createAdminSupabase();
  const body = await req.json();
  const { code, description, discountType, discountValue, minPurchase, maxUses, validUntil } = body;

  const { data, error } = await supabase
    .from("coupons")
    .insert({
      code: code.toUpperCase(),
      description,
      discount_type: discountType,
      discount_value: discountValue,
      min_purchase: minPurchase || null,
      max_uses: maxUses || null,
      valid_until: validUntil ? new Date(validUntil).toISOString() : null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
