import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, resolveTenantForRequest } from "@/lib/supabase/server";

// GET: Loyalty overview (config, rewards, client lookup)
export async function GET(req: NextRequest) {
  const supabase = createAdminSupabase();
  const { searchParams } = new URL(req.url);
  // SEGURIDAD: nunca confiar directo en el tenantId de la URL — resolveTenantForRequest lo
  // reemplaza por el negocio real del usuario logueado salvo que sea super_admin.
  const { tenantId } = await resolveTenantForRequest(searchParams.get("tenantId"));
  const scoped = (q: any) => (tenantId && tenantId !== "ALL" ? q.eq("tenant_id", tenantId) : q);
  const clientId = searchParams.get("clientId");

  // Get config (scoped to the caller's business — each salon has its own program)
  const { data: config } = await scoped(supabase
    .from("loyalty_config")
    .select("*")
    .eq("active", true)).maybeSingle();

  // Get rewards
  const { data: rewards } = await scoped(supabase
    .from("loyalty_rewards")
    .select("*")
    .eq("active", true)
    .order("points_required", { ascending: true }));

  // If clientId, get their points history and balance
  let clientData = null;
  if (clientId) {
    const { data: client } = await supabase
      .from("clients")
      .select("id, name, loyalty_points")
      .eq("id", clientId)
      .single();

    const { data: history } = await supabase
      .from("loyalty_points")
      .select("*")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .limit(20);

    clientData = { ...client, history: history || [] };
  }

  // Top clients by points
  const { data: topClients } = await scoped(supabase
    .from("clients")
    .select("id, name, loyalty_points")
    .gt("loyalty_points", 0)
    .order("loyalty_points", { ascending: false })
    .limit(10));

  return NextResponse.json({
    config: config || { points_per_clp: 1000 },
    rewards: rewards || [],
    client: clientData,
    topClients: topClients || [],
  });
}
