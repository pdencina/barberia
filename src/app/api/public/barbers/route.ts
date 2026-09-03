import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const supabase = createAdminSupabase();
  const { searchParams } = new URL(req.url);
  const branchSlug = searchParams.get("branch");

  // No business specified = don't list anyone. Before this, the generic /booking link
  // (no ?tenant= slug) returned EVERY professional of EVERY business mixed together
  // (Saray and others showed up in Estudio Levels' booking). A public booking page must
  // always be scoped to one business.
  if (!branchSlug) {
    return NextResponse.json([]);
  }

  let query = supabase
    .from("profiles")
    .select("id, name, avatar_url, branch_id, bio, specialties, intro_video_url, years_experience, slot_duration")
    .or("role.eq.barber,and(role.in.(admin,super_admin),also_attends_clients.eq.true)")
    .eq("active", true)
    .order("name");

  // First try to match as tenant slug
  const { data: tenant } = await supabase
    .from("tenants")
    .select("id")
    .eq("slug", branchSlug)
    .eq("active", true)
    .single();

  if (tenant) {
    query = query.eq("tenant_id", tenant.id);
  } else {
    // Try as branch slug
    const { data: branch } = await supabase
      .from("branches")
      .select("id")
      .eq("slug", branchSlug)
      .single();

    if (branch) {
      query = query.eq("branch_id", branch.id);
    } else {
      // Unknown slug — don't leak every professional as a fallback.
      return NextResponse.json([]);
    }
  }

  const { data } = await query;
  return NextResponse.json(data || []);
}
