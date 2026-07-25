import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const supabase = createAdminSupabase();
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status"); // pending, approved, all

  let query = supabase
    .from("inventory_movements")
    .select(`
      *,
      product:products(name),
      barber:profiles(name)
    `)
    .order("created_at", { ascending: false })
    .limit(50);

  if (status && status !== "all") {
    query = query.eq("status", status);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json([]);
  return NextResponse.json(data || []);
}

export async function POST(req: NextRequest) {
  const supabase = createAdminSupabase();
  const body = await req.json();
  const { productId, type, quantity, notes, barberId, requireApproval } = body;

  const needsApproval = requireApproval !== false && type !== "out_sale";

  // Create movement (pending or approved)
  const { data: movement, error } = await supabase
    .from("inventory_movements")
    .insert({
      product_id: productId,
      type,
      quantity,
      notes,
      barber_id: barberId || null,
      status: needsApproval ? "pending" : "approved",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Only update stock if approved immediately
  if (!needsApproval) {
    await updateStock(supabase, productId, type, quantity);
  }

  return NextResponse.json({ ...movement, needsApproval }, { status: 201 });
}

// PATCH: Approve or reject a pending movement
export async function PATCH(req: NextRequest) {
  const supabase = createAdminSupabase();
  const body = await req.json();
  const { movementId, action, adminPin } = body; // action: 'approve' | 'reject'

  // Simple PIN validation (configurable)
  const ADMIN_PIN = process.env.ADMIN_PIN || "1234";
  if (adminPin && adminPin !== ADMIN_PIN) {
    return NextResponse.json({ error: "PIN incorrecto" }, { status: 403 });
  }

  const { data: movement } = await supabase
    .from("inventory_movements")
    .select("*")
    .eq("id", movementId)
    .eq("status", "pending")
    .single();

  if (!movement) {
    return NextResponse.json({ error: "Movimiento no encontrado o ya procesado" }, { status: 404 });
  }

  if (action === "approve") {
    await supabase
      .from("inventory_movements")
      .update({ status: "approved", approved_at: new Date().toISOString() })
      .eq("id", movementId);

    // Update stock
    await updateStock(supabase, movement.product_id, movement.type, movement.quantity);

    return NextResponse.json({ success: true, action: "approved" });
  } else {
    await supabase
      .from("inventory_movements")
      .update({ status: "rejected" })
      .eq("id", movementId);

    return NextResponse.json({ success: true, action: "rejected" });
  }
}

async function updateStock(supabase: any, productId: string, type: string, quantity: number) {
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
}
