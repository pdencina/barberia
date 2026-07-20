import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = createAdminSupabase();
  const body = await req.json();
  const { items, clientId, barberId, paymentMethod, couponCode, discount, subtotal, total } = body;

  // Validate coupon
  let couponId: string | null = null;
  if (couponCode) {
    const { data: coupon } = await supabase
      .from("coupons")
      .select("id")
      .eq("code", couponCode.toUpperCase())
      .single();

    if (coupon) {
      couponId = coupon.id;
      await supabase.rpc("increment_coupon_usage", { coupon_id: coupon.id });
    }
  }

  // Create transaction
  const { data: tx, error } = await supabase
    .from("transactions")
    .insert({
      type: "income",
      status: "completed",
      subtotal,
      discount: discount || 0,
      total,
      payment_method: paymentMethod.toLowerCase(),
      client_id: clientId || null,
      barber_id: barberId,
      coupon_id: couponId,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Insert items
  const itemInserts = items.map((item: any) => ({
    transaction_id: tx.id,
    service_id: item.type === "service" ? item.id : null,
    product_id: item.type === "product" ? item.id : null,
    description: item.name,
    quantity: item.quantity,
    unit_price: item.price,
    total: item.price * item.quantity,
  }));

  await supabase.from("transaction_items").insert(itemInserts);

  // Update product stock + create movements
  for (const item of items) {
    if (item.type === "product") {
      // Decrement stock
      const { data: product } = await supabase
        .from("products")
        .select("stock")
        .eq("id", item.id)
        .single();

      if (product) {
        await supabase
          .from("products")
          .update({ stock: product.stock - item.quantity })
          .eq("id", item.id);
      }

      // Movement record
      await supabase.from("inventory_movements").insert({
        product_id: item.id,
        type: "out_sale",
        quantity: item.quantity,
        barber_id: barberId,
        notes: `Venta POS - ${tx.id.slice(-8)}`,
      });
    }
  }

  return NextResponse.json({ success: true, transactionId: tx.id });
}
