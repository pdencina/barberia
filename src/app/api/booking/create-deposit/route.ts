import { isTenantSuspended, isBarberTenantSuspended, TENANT_SUSPENDED_MESSAGE } from "@/lib/tenant-suspension";
import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";
import { calcularAbono, cargarCredencialAbono, firmarNegocio } from "@/lib/deposit";
import { resolverServicios } from "@/lib/booking-services";
import { horarioDisponible, limpiarHoldsVencidos, crearHold, liberarHold } from "@/lib/deposit-hold";
import { parseWallClock } from "@/lib/wallclock";

/**
 * Creates a MercadoPago Checkout Pro preference for a booking deposit.
 * The client pays online, then gets redirected back with status.
 * 
 * Flow:
 * 1. Booking page calls this with appointment details
 * 2. We create the appointment with status "pending_payment"
 * 3. We create a MP preference (checkout link)
 * 4. Client pays on MP
 * 5. Webhook confirms → appointment changes to "confirmed"
 */
const isValidEmail = (e: unknown) => typeof e === "string" && /^\S+@\S+\.\S+$/.test(e.trim());

export async function POST(req: NextRequest) {
  const supabase = createAdminSupabase();
  const body = await req.json();
  const {
    barberId,
    clientName,
    clientEmail,
    clientPhone,
    serviceIds,
    date,
    startTime,
    notes,
  } = body;

  if (!barberId || !Array.isArray(serviceIds) || !serviceIds.length || serviceIds.length > 20 || !date || !startTime || !clientName || !isValidEmail(clientEmail)) {
    return NextResponse.json({ error: "Campos requeridos faltantes" }, { status: 400 });
  }

  // Get barber's tenant to find MP credentials and deposit config
  const { data: barber } = await supabase
    .from("profiles")
    .select("tenant_id, name")
    .eq("id", barberId)
    .single();

  if (!barber?.tenant_id) {
    return NextResponse.json({ error: "Profesional sin negocio asignado" }, { status: 400 });
  }
  if (await isTenantSuspended(supabase, barber.tenant_id)) {
    return NextResponse.json({ error: TENANT_SUSPENDED_MESSAGE, code: "tenant_suspended" }, { status: 403 });
  }

  // Configuracion del abono del negocio + su cuenta de Mercado Pago (el dinero llega a SU cuenta, no a la de re-booking).
  let cfgRes: { data: any; error: any } = await supabase.from("tenant_settings")
    .select("deposit_enabled, deposit_mode, deposit_percentage, deposit_fixed_amount, deposit_min_amount").eq("tenant_id", barber.tenant_id).maybeSingle();
  if (cfgRes.error) cfgRes = await supabase.from("tenant_settings").select("deposit_enabled, deposit_percentage, deposit_min_amount").eq("tenant_id", barber.tenant_id).maybeSingle();
  const settings = cfgRes.data;
  if (!settings?.deposit_enabled) return NextResponse.json({ error: "Este negocio no cobra abono al reservar" }, { status: 400 });
  const cred = await cargarCredencialAbono(supabase, barber.tenant_id);
  if (!cred.token) return NextResponse.json({ error: "MercadoPago no configurado para este negocio" }, { status: 400 });

  // El total y la duracion se calculan AQUI con los precios del profesional (el navegador no decide cuanto se cobra).
  const resuelto = await resolverServicios(supabase, barberId, barber.tenant_id, serviceIds);
  if (!resuelto) return NextResponse.json({ error: "Servicio no válido" }, { status: 400 });
  const totalPrice = resuelto.total;
  const svcRows = resuelto.servicios;

  // El horario tiene que seguir libre; si lo esta, se BLOQUEA mientras el cliente paga (no se lo puede llevar otra persona).
  const start = parseWallClock(startTime);
  const end = new Date(start.getTime() + resuelto.duracion * 60000);
  await limpiarHoldsVencidos(supabase, { barberId, date });
  const libre = await horarioDisponible(supabase, { barberId, tenantId: barber.tenant_id, date, start, end });
  if (!libre.ok) return NextResponse.json({ error: libre.error, code: "slot_taken" }, { status: 409 });
  const depositPercentage = Number(settings.deposit_percentage) || 30;
  const depositAmount = calcularAbono(totalPrice, {
    mode: settings.deposit_mode === "fixed" ? "fixed" : "percent", percent: depositPercentage,
    fixed: settings.deposit_fixed_amount ?? null, minAmount: settings.deposit_min_amount ?? null,
  });
  if (depositAmount < 1) return NextResponse.json({ error: "No se pudo calcular el abono de esta reserva" }, { status: 400 });

  // Get tenant name for display
  const { data: tenant } = await supabase
    .from("tenants")
    .select("name")
    .eq("id", barber.tenant_id)
    .single();

  const serviceNames = svcRows.map((x: any) => x.name).join(" + ");
  // Direccion canonica CON www: re-booking.cl redirige (307) y Mercado Pago no sigue redirecciones al avisar el pago.
  const baseUrl = (process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "https://www.re-booking.cl").replace(/\/$/, "");

  const holdRef = await crearHold(supabase, { barberId, date, start, end });

  // Create MP Checkout Pro preference
  const preferenceRes = await fetch("https://api.mercadopago.com/checkout/preferences", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${cred.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      items: [{
        title: `Abono - ${serviceNames}`,
        description: `Reserva con ${barber.name} en ${tenant?.name || "re-booking"}`,
        quantity: 1,
        currency_id: "CLP",
        unit_price: depositAmount,
      }],
      payer: {
        name: clientName,
        email: clientEmail || undefined,
      },
      back_urls: {
        success: `${baseUrl}/booking/deposit-success`,
        failure: `${baseUrl}/booking/deposit-failure`,
        pending: `${baseUrl}/booking/deposit-pending`,
      },
      auto_return: "approved",
      external_reference: JSON.stringify({
        barberId,
        clientName,
        clientEmail,
        clientPhone,
        serviceIds,
        date,
        startTime,
        notes,
        totalPrice,
        depositAmount,
        tenantId: barber.tenant_id,
        holdRef,
      }),
      notification_url: `${baseUrl}/api/webhooks/deposit?t=${barber.tenant_id}&s=${firmarNegocio(barber.tenant_id)}`,
      statement_descriptor: tenant?.name || "RE-BOOKING",
      expires: true,
      expiration_date_from: new Date().toISOString(),
      expiration_date_to: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 min to pay
    }),
  });

  const preferenceData = await preferenceRes.json();

  if (!preferenceRes.ok) {
    console.error("MP Preference error:", preferenceData);
    await liberarHold(supabase, holdRef); // no se pudo armar el link de pago: el horario vuelve a quedar libre
    return NextResponse.json({ error: "Error creando link de pago" }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    checkoutUrl: preferenceData.init_point,
    depositAmount,
    depositPercentage,
    preferenceId: preferenceData.id,
  });
}
