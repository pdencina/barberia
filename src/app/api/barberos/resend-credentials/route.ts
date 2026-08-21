import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = createAdminSupabase();
  const { email, name } = await req.json();

  if (!email) {
    return NextResponse.json({ error: "Email requerido" }, { status: 400 });
  }

  // Generate a new temporary password
  const tempPassword = Math.random().toString(36).slice(-8);

  // Update the user's password in Supabase Auth
  const { data: users } = await supabase.auth.admin.listUsers();
  const user = users?.users?.find((u) => u.email === email);

  if (!user) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  await supabase.auth.admin.updateUserById(user.id, { password: tempPassword });

  // Get tenant name
  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  let businessName = "re-booking";
  if (profile?.tenant_id) {
    const { data: tenant } = await supabase
      .from("tenants")
      .select("name")
      .eq("id", profile.tenant_id)
      .single();
    if (tenant?.name) businessName = tenant.name;
  }

  // Send email
  try {
    const { sendWelcomeEmail } = await import("@/lib/resend");
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://re-booking.cl";
    await sendWelcomeEmail({
      to: email,
      professionalName: name || "Profesional",
      businessName,
      password: tempPassword,
      loginUrl: `${baseUrl}/login`,
    });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Error enviando email" }, { status: 500 });
  }
}
