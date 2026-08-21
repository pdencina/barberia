import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const supabase = createAdminSupabase();
  const { searchParams } = new URL(req.url);
  const branchSlug = searchParams.get("branch");

  let query = supabase
    .from("profiles")
    .select("id, name, avatar_url, branch_id, bio, specialties, intro_video_url, years_experience, slot_duration")
    .eq("role", "barber")
    .eq("active", true)
    .order("name");

  if (branchSlug) {
    // First try to match as tenant slug
    const { data: tenant } = await supabase
      .from("tenants")
      .select("id")
      .eq("slug", branchSlug)
      .eq("active", true)
      .single();

    if (tenant) {
      // Filter by tenant
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
      }
    }
  }

  const { data } = await query;
  return NextResponse.json(data || []);
}
