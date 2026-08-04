import { NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";
import { createServerSupabase } from "@/lib/supabase/server";

// POST: Mark onboarding as complete for the current user's tenant
export async function POST() {
  const supabase = createAdminSupabase();
  const serverSupabase = createServerSupabase();

  const { data: { user } } = await serverSupabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  // Get user's tenant
  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  if (profile?.tenant_id) {
    await supabase
      .from("tenants")
      .update({ onboarding_completed: true })
      .eq("id", profile.tenant_id);
  }

  return NextResponse.json({ success: true });
}
