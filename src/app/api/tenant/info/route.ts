import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";

// GET: Get tenant info + plan features for the current user's tenant
export async function GET(req: NextRequest) {
  const supabase = createAdminSupabase();
  const { searchParams } = new URL(req.url);
  const tenantId = searchParams.get("tenantId");

  if (!tenantId) {
    return NextResponse.json({ tenant: null, features: [] });
  }

  // Get tenant
  const { data: tenant } = await supabase
    .from("tenants")
    .select("id, name, slug, plan, status, max_professionals, max_branches, trial_ends_at")
    .eq("id", tenantId)
    .single();

  if (!tenant) {
    return NextResponse.json({ tenant: null, features: [] });
  }

  // Get plan features
  const { data: planConfig } = await supabase
    .from("plan_limits")
    .select("features")
    .eq("plan", tenant.plan)
    .single();

  const features: string[] = planConfig?.features ? JSON.parse(planConfig.features) : [];

  return NextResponse.json({ tenant, features });
}
