import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";

// POST: Client redeems points for a reward
export async function POST(req: NextRequest) {
  const supabase = createAdminSupabase();
  const body = await req.json();
  const { clientId, rewardId } = body;

  if (!clientId || !rewardId) {
    return NextResponse.json({ error: "clientId y rewardId requeridos" }, { status: 400 });
  }

  // Get client balance
  const { data: client } = await supabase
    .from("clients")
    .select("id, name, loyalty_points")
    .eq("id", clientId)
    .single();

  if (!client) return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });

  // Get reward
  const { data: reward } = await supabase
    .from("loyalty_rewards")
    .select("*")
    .eq("id", rewardId)
    .eq("active", true)
    .single();

  if (!reward) return NextResponse.json({ error: "Recompensa no encontrada" }, { status: 404 });

  // Check sufficient points
  if (client.loyalty_points < reward.points_required) {
    return NextResponse.json({
      error: `Puntos insuficientes. Necesitas ${reward.points_required}, tienes ${client.loyalty_points}`,
    }, { status: 400 });
  }

  // Deduct points
  await supabase.from("loyalty_points").insert({
    client_id: clientId,
    points: -reward.points_required,
    reason: "redeem",
    reward_id: rewardId,
  });

  // Update cached balance
  const newBalance = client.loyalty_points - reward.points_required;
  await supabase
    .from("clients")
    .update({ loyalty_points: newBalance })
    .eq("id", clientId);

  // Create a coupon for the client to use
  const couponCode = `FIDELIDAD-${client.name.split(" ")[0].toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
  await supabase.from("coupons").insert({
    code: couponCode,
    description: `Canje fidelidad: ${reward.name}`,
    discount_type: "fixed_amount",
    discount_value: reward.discount_value || 0,
    max_uses: 1,
    valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
  });

  return NextResponse.json({
    success: true,
    newBalance,
    couponCode,
    reward: reward.name,
  });
}
