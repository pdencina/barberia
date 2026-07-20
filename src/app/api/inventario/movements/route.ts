import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET() {
  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from("inventory_movements")
    .select(`
      *,
      product:products(name),
      barber:profiles(name)
    `)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const supabase = createServerSupabase();
  const body = await req.json();
  const { productId, type, quantity, notes, barberId } = body;

  // Create movement
  const { data: movement, error } = await supabase
    .from("inventory_movements")
    .insert({
      product_id: productId,
      type,
      quantity,
      notes,
      barber_id: barberId || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Update product stock
  const { data: product } = await supabase
    .from("products")
    .select("stock")
    .eq("id", productId)
    .single();

  if (product) {
    let newStock = product.stock;
    if (type === "in") newStock += quantity;
    else if (type === "out_use" || type === "out_sale") newStock -= quantity;
    else if (type === "adjustment") newStock = quantity;

    await supabase
      .from("products")
      .update({ stock: newStock })
      .eq("id", productId);
  }

  return NextResponse.json(movement, { status: 201 });
}
