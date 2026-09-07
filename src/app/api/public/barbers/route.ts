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
    .select("id, name, avatar_url, branch_id, bio, specialties, intro_video_url, years_experience, slot_duration, booking_slug")
    .or("role.eq.barber,and(role.in.(admin,super_admin),also_attends_clients.eq.true)")
    .eq("active", true)
    .order("name");

  // Resolve the tenant by slug. Match EXACT first, then fall back to a hyphen-insensitive
  // match (same tolerance business-info already has), so "estudiolevels" resolves to a
  // tenant whose real slug is "estudio-levels". Without this, a one-hyphen difference
  // returned an empty barber list and the booking page showed "selecciona un profesional"
  // even though the business name appeared correctly.
  const norm = (s: string) => s.replace(/-/g, "").toLowerCase();
  let tenantId: string | null = null;

  const { data: exactTenant } = await supabase
    .from("tenants")
    .select("id")
    .eq("slug", branchSlug)
    .eq("active", true)
    .maybeSingle();

  if (exactTenant) {
    tenantId = exactTenant.id;
  } else {
    const { data: allTenants } = await supabase
      .from("tenants")
      .select("id, slug")
      .eq("active", true);
    const fuzzy = (allTenants || []).find((t) => norm(t.slug) === norm(branchSlug));
    if (fuzzy) tenantId = fuzzy.id;
  }

  if (tenantId) {
    query = query.eq("tenant_id", tenantId);
  } else {
    // Try as branch slug (exact, then hyphen-insensitive)
    const { data: exactBranch } = await supabase
      .from("branches")
      .select("id")
      .eq("slug", branchSlug)
      .maybeSingle();

    let branchId: string | null = exactBranch?.id || null;
    if (!branchId) {
      const { data: allBranches } = await supabase.from("branches").select("id, slug");
      const fuzzy = (allBranches || []).find((b) => norm(b.slug) === norm(branchSlug));
      branchId = fuzzy?.id || null;
    }

    if (branchId) {
      query = query.eq("branch_id", branchId);
    } else {
      // Unknown slug — don't leak every professional as a fallback.
      return NextResponse.json([]);
    }
  }

  const { data } = await query;
  return NextResponse.json(data || []);
}
