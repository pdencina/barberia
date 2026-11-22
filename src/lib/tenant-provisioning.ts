// Shared tenant-creation logic. Used by both:
//   - POST /api/superadmin/tenants  (Nico creates a business manually, trial)
//   - POST /api/checkout/subscribe/webhook  (a business self-signs-up and pays, active)
// Extracted so both paths create a tenant the exact same way (settings, subscription,
// admin user, default branch, welcome email) instead of drifting apart.
import { createAdminSupabase } from "@/lib/supabase/server";
import { htmlBienvenidaEmpresa } from "@/lib/mail-bienvenida-empresa";

export interface ProvisionTenantInput {
  name: string;
  slug: string;
  rutEmpresa?: string | null;
  adminEmail: string;
  adminName?: string | null;
  phone?: string | null;
  address?: string | null;
  plan: string;
  maxProfessionals: number;
  maxBranches: number;
  logoUrl?: string | null;
  website?: string | null;
  socialMedia?: string | null;
  // Trial tenants (manual creation) get a trial period + status "trial".
  // Paid signups (self-serve) get status "active" and a full billing period instead.
  trialDays?: number | null;
  status: "trial" | "active";
  periodDays?: number; // for "active": how long until the subscription needs renewing
  priceClp: number;
  // Recurring subscription (Mercado Pago Preapproval) — only set for paid self-serve
  // signups, not manual trial creation.
  billingPeriod?: "monthly" | "annual";
  mpPreapprovalId?: string | null;
}

export interface ProvisionTenantResult {
  tenant: any;
  tempPassword: string;
}

export async function provisionTenant(input: ProvisionTenantInput): Promise<ProvisionTenantResult> {
  const supabase = createAdminSupabase();

  const tempPassword = Math.random().toString(36).slice(-6) + Math.random().toString(36).slice(-4).toUpperCase();

  const now = new Date();
  const periodEnd = new Date(now);
  if (input.status === "trial") {
    periodEnd.setDate(periodEnd.getDate() + (input.trialDays || 15));
  } else {
    periodEnd.setDate(periodEnd.getDate() + (input.periodDays || 30));
  }

  const { data: tenant, error: tenantError } = await supabase
    .from("tenants")
    .insert({
      name: input.name,
      slug: input.slug,
      rut_empresa: input.rutEmpresa || null,
      plan: input.plan,
      max_professionals: input.maxProfessionals,
      max_branches: input.maxBranches,
      admin_email: input.adminEmail,
      admin_name: input.adminName || input.name,
      temp_password: tempPassword,
      must_change_password: true,
      trial_ends_at: input.status === "trial" ? periodEnd.toISOString() : null,
      status: input.status,
      phone: input.phone || null,
      address: input.address || null,
      logo_url: input.logoUrl || null,
      website: input.website || null,
      social_media: input.socialMedia || null,
    })
    .select()
    .single();

  if (tenantError || !tenant) {
    throw new Error(tenantError?.message || "No se pudo crear el negocio");
  }

  await supabase.from("tenant_settings").insert({ tenant_id: tenant.id });

  await supabase.from("subscriptions").insert({
    tenant_id: tenant.id,
    plan: input.plan,
    status: input.status === "active" ? "active" : "trial",
    amount: input.priceClp,
    current_period_start: now.toISOString(),
    current_period_end: periodEnd.toISOString(),
    billing_period: input.billingPeriod || "monthly",
    payment_gateway: "mercadopago", // columna de la migracion 081 (panel Super Admin)
    mp_preapproval_id: input.mpPreapprovalId || null,
  });

  const { data: authUser } = await supabase.auth.admin.createUser({
    email: input.adminEmail,
    password: tempPassword,
    email_confirm: true,
  });

  if (authUser?.user) {
    await supabase.from("profiles").upsert({
      id: authUser.user.id,
      email: input.adminEmail,
      name: input.adminName || input.name,
      role: "admin",
      tenant_id: tenant.id,
      active: true,
      // En un negocio de un solo profesional (Lite, Basic) el dueño es quien atiende: aparece en la agenda y ocupa el asiento.
      ...(input.maxProfessionals <= 1 ? { also_attends_clients: true, work_mode: "rental", rental_daily_rate: 0 } : {}),
    });
  }

  await supabase.from("branches").insert({
    name: `${input.name} - Principal`,
    slug: input.slug,
    tenant_id: tenant.id,
    phone: input.phone || null,
    address: input.address || null,
  });

  // Aviso a los super admin: negocio nuevo.
  try {
    const { notifyPlatform } = await import("@/lib/platform-alerts");
    await notifyPlatform({
      kind: "tenant_new",
      title: "Nuevo negocio registrado",
      body: `${input.name} · plan ${input.plan}${input.status === "trial" ? ` (${input.trialDays || 15} días de prueba)` : " (activo)"}`,
      url: "/dashboard/superadmin/tenants",
    });
  } catch {}

  try {
    const { getResendClient } = await import("@/lib/resend-client");
    const resend = getResendClient();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.re-booking.cl";
    const planLabel = input.plan.charAt(0).toUpperCase() + input.plan.slice(1);
    const trialLine = input.status === "trial"
      ? `${planLabel} (${input.trialDays || 15} días gratis)`
      : `${planLabel} (activo)`;

    // Mismo estilo que el resto de los correos de re-booking (encabezado verde con logo blanco).
    await resend.emails.send({
      from: process.env.EMAIL_FROM || "re-booking <no-reply@re-booking.cl>",
      to: input.adminEmail,
      subject: `Bienvenido a re-booking — Tus datos de acceso`,
      html: htmlBienvenidaEmpresa({ adminName: input.adminName || input.name, businessName: input.name, adminEmail: input.adminEmail, tempPassword, planLine: trialLine, appUrl }),
    });
  } catch (e) {
    console.error("Error sending welcome email:", e);
  }

  return { tenant, tempPassword };
}
