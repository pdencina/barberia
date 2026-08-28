import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createAdminSupabase, getCurrentTenantId } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  // Use admin client to bypass RLS - barbers list is internal data
  const supabase = createAdminSupabase();
  const { searchParams } = new URL(req.url);
  const tenantId = searchParams.get("tenantId") || await getCurrentTenantId();

  // If no tenant, return empty (except super_admin)
  if (!tenantId) {
    return NextResponse.json([]);
  }

  let query = supabase
    .from("profiles")
    .select("id, name, email, phone, avatar_url, role")
    .in("role", ["barber", "receptionist", "admin"])
    .eq("active", true)
    .order("name");

  if (tenantId !== "ALL") {
    query = query.eq("tenant_id", tenantId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching barbers:", error.message);
    return NextResponse.json([]);
  }
  return NextResponse.json(data || []);
}

export async function POST(req: NextRequest) {
  const adminSupabase = createAdminSupabase();
  const body = await req.json();
  const { name, email, phone, password, tenantId, role } = body;

  const tempPassword = password || Math.random().toString(36).slice(-8);
  const userRole = role || "barber";

  // Create user in Supabase Auth
  const { data: authData, error: authError } = await adminSupabase.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { name, role: userRole },
  });

  if (authError) {
    if (authError.message.includes("already") || authError.message.includes("exists")) {
      return NextResponse.json({ error: "Ya existe una cuenta con ese email. Usa otro email o edita el profesional existente." }, { status: 409 });
    }
    return NextResponse.json({ error: authError.message }, { status: 500 });
  }

  // Update phone and tenant in profile
  if (authData.user) {
    // Resolve tenant_id: prefer param, fallback to session
    let resolvedTenantId = tenantId;
    if (!resolvedTenantId) {
      const { getCurrentTenantId } = await import("@/lib/supabase/server");
      resolvedTenantId = await getCurrentTenantId();
      if (resolvedTenantId === "ALL") resolvedTenantId = null; // super_admin without override
    }

    const updates: any = { role: userRole };
    if (phone) updates.phone = phone;
    if (resolvedTenantId) updates.tenant_id = resolvedTenantId;

    // Use upsert: if trigger already created the profile, update it.
    // If not, create it with all the data.
    const { error: profileError } = await adminSupabase
      .from("profiles")
      .upsert({
        id: authData.user.id,
        name,
        email,
        role: userRole,
        phone: phone || null,
        tenant_id: resolvedTenantId || null,
        active: true,
      }, { onConflict: "id" });

    // If the profile couldn't be created, we'd be left with an orphaned auth user
    // (can log in but has no role/tenant → treated wrong by the app). Roll back the
    // auth user and report the real error instead of returning a false success.
    if (profileError) {
      await adminSupabase.auth.admin.deleteUser(authData.user.id).catch(() => {});
      return NextResponse.json(
        { error: `No se pudo crear el perfil del profesional: ${profileError.message}` },
        { status: 500 }
      );
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
