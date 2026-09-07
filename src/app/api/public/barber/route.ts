import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";

// GET a single professional by id, for the personal booking link. This is the reliable
// path: the barber is resolved DIRECTLY by id, not by matching against a
// tenant-filtered list (which broke when the slug didn't line up and showed
// "selecciona un profesional"). Also returns the barber's tenant so the booking page
// can load that business's branding.
export async function GET(req: NextRequest) {
  const supabase = createAdminSupabase();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const { data: barber } = await supabase
    .from("profiles")
    .select("id, name, avatar_url, bio, specialties, intro_video_url, years_experience, slot_duration, tenant_id")
    .eq("id", id)
    .eq("active", true)
    .maybeSingle();

  if (!barber) return NextResponse.json({ error: "Profesional no encontrado" }, { status: 404 });

  // Include the business slug + logo so the booking page can brand itself.
  let tenant: any = null;
  if (barber.tenant_id) {
    const { data: t } = await supabase
      .from("tenants")
      .select("id, name, slug, logo_url")
      .eq("id", barber.tenant_id)
      .maybeSingle();
    tenant = t || null;
  }

  return NextResponse.json({ barber, tenant });
}
