import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const supabase = createAdminSupabase();
  const { searchParams } = new URL(req.url);
  const branchSlug = searchParams.get("branch");

  let query = supabase
    .from("profiles")
    .select("id, name, avatar_url, branch_id")
    .eq("role", "barber")
    .eq("active", true)
    .order("name");

  // Filter by branch if specified
  if (branchSlug) {
    const { data: branch } = await supabase
      .from("branches")
      .select("id")
      .eq("slug", branchSlug)
      .single();

    if (branch) {
      query = query.eq("branch_id", branch.id);
    }
  }

  const { data } = await query;
  return NextResponse.json(data || []);
}
