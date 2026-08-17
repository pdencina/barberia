import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = createAdminSupabase();
  const { businessType, professionals, name, email, phone, password } = await req.json();

  if (!name || !email || !password) {
    return NextResponse.json({ error: "Nombre, email y contraseña son obligatorios" }, { status: 400 });
  }

  // Create user in Supabase Auth
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name, role: "admin" },
  });

  if (authError) {
    if (authError.message.includes("already")) {
      return NextResponse.json({ error: "Ya existe una cuenta con ese email" }, { status: 409 });
    }
    return NextResponse.json({ error: authError.message }, { status: 500 });
  }

  if (!authData.user) {
    return NextResponse.json({ error: "Error creando usuario" }, { status: 500 });
  }

  // Create tenant
  const slug = name.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 30);

  const { data: tenant, error: tenantError } = await supabase
    .from("tenants")
    .insert({
      name: name.split(" ")[0] + " Business", // Default business name
      slug: `${slug}-${Date.now().toString(36).slice(-4)}`,
      admin_email: email,
      admin_name: name,
      plan: "starter",
      status: "trial",
      trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(), // 14 day trial
      phone: phone || null,
    })
    .select()
    .single();

  if (tenantError) {
    return NextResponse.json({ error: tenantError.message }, { status: 500 });
  }

  // Link user to tenant as admin
  await supabase
    .from("profiles")
    .update({
      tenant_id: tenant.id,
      role: "admin",
      phone: phone || null,
    })
    .eq("id", authData.user.id);

  // Create tenant_settings
  await supabase
    .from("tenant_settings")
    .insert({
      tenant_id: tenant.id,
    });

  // Log metadata
  await supabase
    .from("audit_log")
    .insert({
      action: "tenant_created",
      entity_type: "tenant",
      entity_id: tenant.id,
      description: `Nuevo negocio registrado: ${name} (${businessType}, ${professionals} profesionales)`,
      user_id: authData.user.id,
      user_name: name,
      metadata: { businessType, professionals, email },
    });

  return NextResponse.json({ success: true, tenantId: tenant.id });
}
