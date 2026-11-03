import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";
import { calculateSubscriptionAmount, validateProfessionals, type BillingPeriod } from "@/lib/subscription-pricing";
import { MP_API, getMpPublicUrl, createCheckoutPreference } from "@/lib/mercadopago";
import { codigoValido, normalizarCodigo, esAutoReferido, PREMIO } from "@/lib/referidos";
import { montoConDescuento } from "@/lib/referidos-beneficios";

// POST: A business fills /suscribirse and hits "Continuar al pago". This:
//   1. Validates the plan + business data + professionals + billing period
//   2. Saves a pending signup_requests row (the tenant does NOT exist yet — only
//      created once the webhook confirms the subscription's first payment, see
//      src/app/api/checkout/subscribe/webhook/route.ts)
//   3. MENSUAL: creates a Mercado Pago SUBSCRIPTION (Preapproval) so MP charges the
//      business's card automatically every month. Returns the init_point where the
//      business authorizes the card.
//      ANUAL: creates a one-time Checkout Pro preference for the whole year (with the
//      20% discount). No automatic renewal — /api/cron/annual-renewals emails the
//      business a payment link before it expires (Mercado Pago's plan/subscription
//      amount cap of $350.000 CLP does not apply to one-time payments).
//   The plan Enterprise is NOT self-serve (custom price, handled by sales).
async function handlePost(req: NextRequest) {
  const body = await req.json();
  const {
    name,
    slug,
    rut_empresa,
    admin_name,
    admin_email,
    phone,
    plan,
    professionals: professionalsRaw,
    billing_period,
    ref,
  } = body;

  if (plan === "enterprise") {
    return NextResponse.json({ error: "El plan Enterprise se contrata con un ejecutivo de ventas" }, { status: 400 });
  }

  if (!name || !slug || !admin_name || !admin_email || !plan) {
    return NextResponse.json({ error: "Faltan datos obligatorios" }, { status: 400 });
  }

  if (!/^[a-z0-9-]+$/.test(slug)) {
    return NextResponse.json({ error: "Identificador inválido (usa minúsculas, números y guiones)" }, { status: 400 });
  }

  const billingPeriod: BillingPeriod = billing_period === "annual" ? "annual" : "monthly";
  const professionals = Number.isFinite(Number(professionalsRaw)) ? Math.round(Number(professionalsRaw)) : 1;

  const accessToken = process.env.MP_PLATFORM_ACCESS_TOKEN;
  if (!accessToken) {
    return NextResponse.json({ error: "Mercado Pago no configurado" }, { status: 500 });
  }

  const supabase = createAdminSupabase();

  // Slug must be unique across tenants (checked again at provisioning time, but we
  // fail fast here so the business doesn't pay only to be rejected afterwards).
  const { data: existingTenant } = await supabase.from("tenants").select("id").eq("slug", slug).single();
  if (existingTenant) {
    return NextResponse.json({ error: "Ese identificador ya está en uso" }, { status: 409 });
  }

  // El email del administrador debe ser nuevo: si ya existe un usuario con ese email, el alta
  // del negocio no podria crear su acceso y el cliente pagaria sin poder entrar.
  const adminEmailNorm = String(admin_email).trim().toLowerCase();
  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("id")
    .ilike("email", adminEmailNorm)
    .limit(1);
  if (existingProfile && existingProfile.length > 0) {
    return NextResponse.json(
      { error: "Ya existe una cuenta con ese email. Usa otro email para el administrador del nuevo negocio, o inicia sesión si ya eres cliente." },
      { status: 409 }
    );
  }

  const { data: planConfig } = await supabase
    .from("plan_limits")
    .select("*") // incluye seat_prices (migracion 109) si existe
    .eq("plan", plan)
    .single();

  if (!planConfig) {
    return NextResponse.json({ error: "Plan inválido" }, { status: 400 });
  }
  if (!planConfig.price_clp || planConfig.price_clp <= 0) {
    return NextResponse.json({ error: "Este plan no tiene pago en línea configurado, contacta a ventas" }, { status: 400 });
  }

  const professionalsError = validateProfessionals(planConfig, professionals);
  if (professionalsError) {
    return NextResponse.json({ error: professionalsError }, { status: 400 });
  }

  // El monto SIEMPRE se calcula en el servidor — nunca se confia en un total que
  // venga del cliente. Incluye el IVA (19%) y, si aplica, el descuento anual (20%).
  const { monto, frequency } = calculateSubscriptionAmount(planConfig, professionals, billingPeriod);

  // Referido (etapa 1: solo se registra, no cambia el cobro). Un codigo invalido o un auto-referido se ignoran en silencio: nunca bloquean el alta.
  let referrerTenantId: string | null = null;
  let refCode: string | null = null;
  if (codigoValido(ref)) {
    try {
      const code = normalizarCodigo(ref);
      const { data: inv } = await supabase.from("tenants").select("id, rut_empresa").eq("referral_code", code).maybeSingle();
      if (inv) {
        const { data: admins } = await supabase.from("profiles").select("email").eq("tenant_id", inv.id).in("role", ["admin", "super_admin"]);
        const propio = esAutoReferido({ adminEmails: ((admins as any[]) || []).map((a) => a.email || ""), rut: (inv as any).rut_empresa ?? null }, { email: adminEmailNorm, rut: rut_empresa || null });
        if (!propio) { referrerTenantId = inv.id; refCode = code; }
      }
    } catch (e) { console.error("[subscribe] referido ignorado:", e); }
  }

  // Create the pending signup request first — its id becomes the MP external_reference,
  // so the webhook can find it once the subscription is authorized.
  const baseSignup = {
      name,
      slug,
      rut_empresa: rut_empresa || null,
      admin_email,
      admin_name,
      phone: phone || null,
      plan,
      professionals,
      billing_period: billingPeriod,
      amount: monto,
      status: "pending",
  };
  let { data: signupRequest, error: signupError } = await supabase
    .from("signup_requests").insert((refCode ? { ...baseSignup, referral_code: refCode } : baseSignup) as Record<string, any>).select().single();
  // Si falta la migracion 120, se reintenta sin la columna nueva (el alta nunca se pierde por esto).
  if (signupError && refCode) {
    refCode = null; referrerTenantId = null;
    ({ data: signupRequest, error: signupError } = await supabase.from("signup_requests").insert(baseSignup).select().single());
  }

  if (signupError || !signupRequest) {
    return NextResponse.json({ error: signupError?.message || "No se pudo iniciar el registro" }, { status: 500 });
  }

  // Descuento del referido (solo plan MENSUAL y con NEXT_PUBLIC_REFERIDOS=1): primero se guarda el referido CON sus datos de descuento; si eso falla
  // (p. ej. falta la migracion 121) NO se descuenta, para no dejar a nadie con un precio rebajado que nunca vuelve al normal.
  let montoPreapproval = monto;
  if (refCode && referrerTenantId) {
    const quiereDescuento = process.env.NEXT_PUBLIC_REFERIDOS === "1" && billingPeriod === "monthly";
    const base = { referrer_tenant_id: referrerTenantId, referred_signup_id: signupRequest.id, code: refCode };
    let guardado = false;
    if (quiereDescuento) {
      const { error: e1 } = await supabase.from("referrals").insert({ ...base, discount_pct: PREMIO.referidoDescuentoPct, discount_months: PREMIO.referidoMeses, full_amount: monto });
      if (!e1) { guardado = true; montoPreapproval = montoConDescuento(monto, PREMIO.referidoDescuentoPct); }
      else console.error("[subscribe] referido sin descuento (falta migracion 121?):", e1.message);
    }
    if (!guardado) {
      const { error: e2 } = await supabase.from("referrals").insert(base);
      if (e2) console.error("[subscribe] no se pudo registrar el referido:", e2.message);
    }
  }

  const appUrl = getMpPublicUrl();
  const backUrl = `${appUrl}/suscripcion/resultado?req=${signupRequest.id}`;

  if (billingPeriod === "annual") {
    const pref = await createCheckoutPreference({
      accessToken,
      title: `re-booking — Plan ${planConfig.name} (anual)`,
      amount: monto,
      payerEmail: admin_email,
      externalReference: signupRequest.id,
      backUrl,
    });
    if (!pref.ok) {
      return NextResponse.json({ error: "Error creando el pago" }, { status: 500 });
    }
    await supabase.from("signup_requests").update({ mp_preference_id: pref.id }).eq("id", signupRequest.id);
    return NextResponse.json({ initPoint: pref.initPoint });
  }

  const response = await fetch(`${MP_API}/preapproval`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      reason: `re-booking — Plan ${planConfig.name} (mensual)`,
      external_reference: signupRequest.id,
      payer_email: admin_email,
      back_url: backUrl,
      notification_url: `${appUrl}/api/checkout/subscribe/webhook`,
      // Sin plan asociado + "pending" => Mercado Pago devuelve init_point para que el
      // negocio autorice la tarjeta (con "authorized" pediria card_token_id).
      status: "pending",
      auto_recurring: {
        frequency,
        frequency_type: "months",
        transaction_amount: montoPreapproval,
        currency_id: "CLP",
      },
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    console.error("MercadoPago error (subscribe/preapproval):", data);
    const cause = Array.isArray(data?.cause)
      ? data.cause.map((c: any) => c?.description || c?.code).filter(Boolean).join("; ")
      : "";
    const detail = [data?.message || data?.error, cause, data?.status ? `(status ${data.status})` : ""]
      .filter(Boolean)
      .join(" ") + (process.env.NODE_ENV !== "production" ? ` | MP: ${JSON.stringify(data).slice(0, 500)}` : "");
    return NextResponse.json(
      { error: `Error creando la suscripción de pago${detail ? `: ${detail}` : ""}` },
      { status: 500 }
    );
  }

  await supabase
    .from("signup_requests")
    .update({ mp_preapproval_id: data.id })
    .eq("id", signupRequest.id);

  return NextResponse.json({
    initPoint: data.init_point,
  });
}

export async function POST(req: NextRequest) {
  try {
    return await handlePost(req);
  } catch (err: any) {
    console.error("[checkout/subscribe]", err);
    return NextResponse.json(
      { error: `No se pudo iniciar el pago: ${err?.message || "error interno"}` },
      { status: 500 }
    );
  }
}
