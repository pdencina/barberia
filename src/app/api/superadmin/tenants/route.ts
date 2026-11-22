import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, getCurrentUserRoleAndTenant } from "@/lib/supabase/server";
import { BUSINESS_CATEGORY_VALUES } from "@/lib/business-categories";
import { htmlBienvenidaEmpresa } from "@/lib/mail-bienvenida-empresa";

// SEGURIDAD (Nico, 25-sep): esta ruta lista/crea TODAS las empresas de la plataforma
// (no solo la del que llama) y antes no verificaba el rol en el servidor — cualquiera
// autenticado podia listar el resto de los negocios. Se agrega el mismo guard que se usa
// en el resto de las rutas de Superadmin.
async function requireSuperAdmin() {
  const { role } = await getCurrentUserRoleAndTenant();
  if (role !== "super_admin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  return null;
}

// GET: List all tenants
export async function GET() {
  const denied = await requireSuperAdmin();
  if (denied) return denied;

  const supabase = createAdminSupabase();

  const { data: tenants } = await supabase
    .from("tenants")
    .select(`
      *,
      subscription:subscriptions(plan, status, current_period_end)
    `)
    .order("created_at", { ascending: false });

  return NextResponse.json(tenants || []);
}

// POST: Create new tenant (business)
export async function POST(req: NextRequest) {
  const denied = await requireSuperAdmin();
  if (denied) return denied;

  const supabase = createAdminSupabase();
  const body = await req.json();
  const { name, slug, rut_empresa, admin_email, admin_name, phone, address, city, plan, logo_url, website, social_media, trial_days, max_professionals, business_category } = body;

  // Validations
  if (!name || !slug || !admin_email) {
    return NextResponse.json({ error: "name, slug y admin_email son obligatorios" }, { status: 400 });
  }

  // Punto 22 (Pablo): periodo de prueba configurable al crear el negocio (antes 15 dias
  // fijo). Se acota a un rango razonable para evitar un valor invalido/negativo.
  const trialDays = Number.isFinite(Number(trial_days)) && Number(trial_days) > 0
    ? Math.min(Math.round(Number(trial_days)), 365)
    : 15;

  if (!/^[a-z0-9-]+$/.test(slug)) {
    return NextResponse.json({ error: "Slug solo puede tener letras minusculas, numeros y guiones" }, { status: 400 });
  }

  // Check slug unique
  const { data: existing } = await supabase
    .from("tenants")
    .select("id")
    .eq("slug", slug)
    .single();

  if (existing) {
    return NextResponse.json({ error: "Ese identificador ya esta en uso" }, { status: 409 });
  }

  // Generate temp password
  const tempPassword = Math.random().toString(36).slice(-6) + Math.random().toString(36).slice(-4).toUpperCase();

  // Plan limits
  const selectedPlan = plan || "starter";
  const { data: planConfig } = await supabase
    .from("plan_limits")
    .select("max_professionals, max_branches, price_clp")
    .eq("plan", selectedPlan)
    .single();

  // Pedido de Nico (26-sep): esta ruta solo la puede llamar super_admin (ver
  // requireSuperAdmin arriba), asi que se permite desacoplar el limite de profesionales
  // del plan elegido — ej. crear un negocio en plan Pro pero con solo 1-2 profesionales
  // (para probar), o en plan Basic con 10 (un caso especial acordado con el cliente). Si
  // no se manda max_professionals, se usa el default del plan como siempre.
  const overrideMaxProfessionals = Number(max_professionals);
  const maxProfessionals = Number.isFinite(overrideMaxProfessionals) && overrideMaxProfessionals > 0
    ? Math.round(overrideMaxProfessionals)
    : (planConfig?.max_professionals || 3);
  const maxBranches = planConfig?.max_branches || 1;

  // Trial: configurable, 15 dias por defecto.
  const trialEnds = new Date();
  trialEnds.setDate(trialEnds.getDate() + trialDays);

  // Create tenant
  const { data: tenant, error: tenantError } = await supabase
    .from("tenants")
    .insert({
      name,
      slug,
      rut_empresa: rut_empresa || null,
      plan: selectedPlan,
      max_professionals: maxProfessionals,
      max_branches: maxBranches,
      admin_email,
      admin_name: admin_name || name,
      temp_password: tempPassword,
      must_change_password: true,
      trial_ends_at: trialEnds.toISOString(),
      status: "trial",
      phone: phone || null,
      address: address || null,
      city: (city || "").trim() || null,
      logo_url: logo_url || null,
      website: website || null,
      social_media: social_media || null,
      // Rubro (migracion 078): solo valores validos; cualquier otra cosa = sin clasificar.
      business_category: BUSINESS_CATEGORY_VALUES.includes(business_category) ? business_category : null,
    })
    .select()
    .single();

  if (tenantError) {
    return NextResponse.json({ error: tenantError.message }, { status: 500 });
  }

  // Create default settings
  await supabase.from("tenant_settings").insert({ tenant_id: tenant.id });

  // Create subscription (trial)
  await supabase.from("subscriptions").insert({
    tenant_id: tenant.id,
    plan: selectedPlan,
    status: "trial",
    amount: planConfig?.price_clp || 0,
    current_period_start: new Date().toISOString(),
    current_period_end: trialEnds.toISOString(),
  });

  // Create auth user for the tenant admin
  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email: admin_email,
    password: tempPassword,
    email_confirm: true,
  });

  // Create profile linked to tenant
  if (authUser?.user) {
    await supabase.from("profiles").upsert({
      id: authUser.user.id,
      email: admin_email,
      name: admin_name || name,
      role: "admin",
      tenant_id: tenant.id,
      active: true,
      // En un negocio de un solo profesional (Lite, Basic) el dueño es quien atiende: aparece en la agenda y se puede reservar con él.
      ...(maxProfessionals <= 1 ? { also_attends_clients: true, work_mode: "rental", rental_daily_rate: 0 } : {}),
    });
  }

  // Create default branch for tenant
  await supabase.from("branches").insert({
    name: `${name} - Principal`,
    slug: slug,
    tenant_id: tenant.id,
    phone: phone || null,
    address: address || null,
  });

  // Send welcome email
  try {
    const { getResendClient } = await import("@/lib/resend-client");
    const resend = getResendClient();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.re-booking.cl";

    await resend.emails.send({
      from: process.env.EMAIL_FROM || "re-booking <no-reply@re-booking.cl>",
      to: admin_email,
      subject: `Bienvenido a re-booking — Tus datos de acceso`,
      html: htmlBienvenidaEmpresa({ adminName: admin_name || name, businessName: name, adminEmail: admin_email, tempPassword, planLine: `${selectedPlan.charAt(0).toUpperCase() + selectedPlan.slice(1)} (${trialDays} días gratis)`, appUrl }),
    });
  } catch (e) {
    console.error("Error sending welcome email:", e);
  }

  return NextResponse.json({
    tenant,
    temp_password: tempPassword,
    message: `Empresa creada. Trial de ${trialDays} dias activo.`,
    login_url: `${process.env.NEXT_PUBLIC_APP_URL || "https://www.re-booking.cl"}/login`,
  }, { status: 201 });
}
