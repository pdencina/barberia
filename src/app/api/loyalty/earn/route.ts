import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";

// POST: Client earns points from a transaction
export async function POST(req: NextRequest) {
  const supabase = createAdminSupabase();
  const body = await req.json();
  const { clientId, transactionId, amount } = body;

  if (!clientId || !amount) {
    return NextResponse.json({ error: "clientId y amount requeridos" }, { status: 400 });
  }

  // Get the client's business so we use THAT business's points-per-CLP config,
  // not an arbitrary one (loyalty_config has one row per business).
  const { data: clientRow } = await supabase
    .from("clients")
    .select("tenant_id")
    .eq("id", clientId)
    .single();

  let configQuery = supabase.from("loyalty_config").select("points_per_clp").eq("active", true);
  if (clientRow?.tenant_id) configQuery = configQuery.eq("tenant_id", clientRow.tenant_id);
  const { data: config } = await configQuery.maybeSingle();

  const pointsPerClp = config?.points_per_clp || 1000;
  const pointsEarned = Math.floor(amount / pointsPerClp);

  if (pointsEarned <= 0) {
    return NextResponse.json({ points: 0, message: "Monto insuficiente para puntos" });
  }

  // Add points
  await supabase.from("loyalty_points").insert({
    client_id: clientId,
    points: pointsEarned,
    reason: "purchase",
    transaction_id: transactionId || null,
  });

  // Update client cached balance
  const { data: client } = await supabase
    .from("clients")
    .select("loyalty_points")
    .eq("id", clientId)
    .single();

  const newBalance = (client?.loyalty_points || 0) + pointsEarned;
  await supabase
    .from("clients")
    .update({ loyalty_points: newBalance })
    .eq("id", clientId);

  return NextResponse.json({ points: pointsEarned, newBalance });
}
