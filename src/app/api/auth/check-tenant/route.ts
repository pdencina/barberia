import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";

// GET: Check if this email belongs to a tenant that needs password change
export async function GET(req: NextRequest) {
  const supabase = createAdminSupabase();
  const { searchParams } = new URL(req.url);
  const email = searchParams.get("email");

  if (!email) return NextResponse.json({ must_change_password: false });

  // Check tenants table
  const { data: tenant } = await supabase
    .from("tenants")
    .select("id, must_change_password, name, slug")
    .eq("admin_email", email)
    .single();

  if (tenant) {
    return NextResponse.json({
      must_change_password: tenant.must_change_password,
      tenant_id: tenant.id,
      tenant_name: tenant.name,
      tenant_slug: tenant.slug,
    });
  }

  return NextResponse.json({ must_change_password: false });
}
