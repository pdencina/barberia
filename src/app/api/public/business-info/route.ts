import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";

// GET: Get public business info by slug (for subdomain booking pages)
export async function GET(req: NextRequest) {
  const supabase = createAdminSupabase();
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug");

  if (!slug) {
    return NextResponse.json({ error: "slug required" }, { status: 400 });
  }

  const { data: tenant } = await supabase
    .from("tenants")
    .select("id, name, slug, logo_url, phone, address")
    .eq("slug", slug)
    .eq("active", true)
    .single();

  if (!tenant) {
    // Try partial match (e.g., "estudiolevels" matches "estudio-levels")
    const { data: tenants } = await supabase
      .from("tenants")
      .select("id, name, slug, logo_url, phone, address")
      .eq("active", true);

    const match = (tenants || []).find((t) =>
      t.slug.replace(/-/g, "").toLowerCase() === slug.replace(/-/g, "").toLowerCase()
    );

    if (match) return NextResponse.json(match);
    return NextResponse.json({ error: "Negocio no encontrado" }, { status: 404 });
  }

  return NextResponse.json(tenant);
}
