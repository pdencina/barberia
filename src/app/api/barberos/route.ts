import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase/server";

export async function GET() {
  // Use admin client to bypass RLS - barbers list is internal data
  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, name, email, phone, avatar_url")
    .eq("role", "barber")
    .eq("active", true)
    .order("name");

  if (error) {
    console.error("Error fetching barbers:", error.message);
    return NextResponse.json([]);
  }
  return NextResponse.json(data || []);
}

export async function POST(req: NextRequest) {
  const adminSupabase = createAdminSupabase();
  const body = await req.json();
  const { name, email, phone, password, tenantId } = body;

  const tempPassword = password || Math.random().toString(36).slice(-8);

  // Create user in Supabase Auth
  const { data: authData, error: authError } = await adminSupabase.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { name, role: "barber" },
  });

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 500 });
  }

  // Update phone and tenant in profile
  if (authData.user) {
    const updates: any = {};
    if (phone) updates.phone = phone;
    if (tenantId) updates.tenant_id = tenantId;
    if (Object.keys(updates).length > 0) {
      await adminSupabase
        .from("profiles")
        .update(updates)
        .eq("id", authData.user.id);
    }
  }

  // Send welcome email with credentials
  try {
    let businessName = "tu negocio";
    if (tenantId) {
      const { data: tenant } = await adminSupabase
        .from("tenants")
        .select("name")
        .eq("id", tenantId)
        .single();
      if (tenant?.name) businessName = tenant.name;
    }

    const { sendWelcomeEmail } = await import("@/lib/resend");
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://re-booking.cl";
    await sendWelcomeEmail({
      to: email,
      professionalName: name,
      businessName,
      password: tempPassword,
      loginUrl: `${baseUrl}/login`,
    });
  } catch (e) {
    // Don't fail the creation if email fails
    console.error("Error sending welcome email:", e);
  }

  return NextResponse.json(
    { id: authData.user.id, name, email },
    { status: 201 }
  );
}
