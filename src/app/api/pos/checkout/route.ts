import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = createAdminSupabase();
  const body = await req.json();
  const { items, clientId, barberId, paymentMethod, payments, couponCode, discount, subtotal, total } = body;
  // payments: optional array [{method: "cash", amount: 10000}, {method: "debit_card", amount: 7000}]
  // If not provided, falls back to single paymentMethod for full total

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

  // Determine primary payment method (for the transaction record)
  const primaryMethod = payments && payments.length > 0
    ? (payments.length > 1 ? "mixed" : payments[0].method)
    : (paymentMethod || "cash");

  // Create transaction
  const { data: tx, error } = await supabase
    .from("transactions")
    .insert({
      type: "income",
      status: "completed",
      subtotal,
      discount: discount || 0,
      total,
      payment_method: primaryMethod,
      client_id: clientId || null,
      barber_id: barberId,
      coupon_id: couponId,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Save split payment details
  if (payments && payments.length > 0) {
    const paymentInserts = payments.map((p: { method: string; amount: number }) => ({
      transaction_id: tx.id,
      payment_method: p.method,
      amount: p.amount,
    }));
    await supabase.from("transaction_payments").insert(paymentInserts);
  }

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

  // Award loyalty points if client is attached
  if (clientId && total > 0) {
    try {
      const { data: config } = await supabase
        .from("loyalty_config")
        .select("points_per_clp")
        .eq("active", true)
        .single();

      const pointsPerClp = config?.points_per_clp || 1000;
      const pointsEarned = Math.floor(total / pointsPerClp);

      if (pointsEarned > 0) {
        await supabase.from("loyalty_points").insert({
          client_id: clientId,
          points: pointsEarned,
          reason: "purchase",
          transaction_id: tx.id,
        });

        // Update cached balance
        const { data: client } = await supabase
          .from("clients")
          .select("loyalty_points")
          .eq("id", clientId)
          .single();

        await supabase
          .from("clients")
          .update({ loyalty_points: (client?.loyalty_points || 0) + pointsEarned })
          .eq("id", clientId);
      }
    } catch (e) {
      console.error("Error awarding loyalty points:", e);
    }
  }

  return NextResponse.json({ success: true, transactionId: tx.id });
}
