import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET() {
  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from("coupons")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json([]);
  return NextResponse.json(data || []);
}

export async function POST(req: NextRequest) {
  const supabase = createServerSupabase();
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
