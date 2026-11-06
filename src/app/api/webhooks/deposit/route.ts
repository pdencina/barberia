import { apptNoticeUrl, apptDayLabel } from "@/lib/appt-link";
import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";
import { tryConsumeQuota } from "@/lib/message-quota";
import { notify } from "@/lib/notify";
import { cargarCredencialAbono, firmaValida } from "@/lib/deposit";
import { horarioLibreTrasPago, perdioCarrera, liberarHold } from "@/lib/deposit-hold";
import { reclamarPago } from "@/lib/deposit-claim";
import { resolverServicios } from "@/lib/booking-services";
import { parseWallClock } from "@/lib/wallclock";
import { leerIntento } from "@/lib/booking-intent";

// Deja anotado en la reserva en espera si se pagó (o si el horario se ocupó) para que la página de reservas lo muestre.
async function marcarResultado(supabase: any, referencia: unknown, data: Record<string, any>, extra: Record<string, unknown>) {
  const ref = String(referencia ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(ref)) return;
  await supabase.from("booking_intents").update({ data: { ...data, ...extra } }).eq("ref", ref).then(() => {}, () => {});
}

/**
 * MercadoPago Webhook for deposit payments.
 * Called by MP when payment status changes.
 * 
 * Flow:
 * 1. MP sends notification with payment ID
 * 2. We fetch payment details from MP
 * 3. If approved → create appointment + mark deposit as paid
 * 4. Send confirmation email to client
 */
export async function POST(req: NextRequest) {
  const supabase = createAdminSupabase();

  try {
    const body = await req.json();

    // MP sends different notification types
    const topic = body.type || body.topic;
    const paymentId = body.data?.id || body.resource?.split("/").pop();

    if (!paymentId || (topic !== "payment" && topic !== "merchant_order")) {
      return NextResponse.json({ ok: true }); // Acknowledge but ignore non-payment notifications
    }

    // Los avisos nuevos traen el negocio y una firma (?t=&s=): se usa SU token, sin probar los de todos.
    // Los avisos de links antiguos (sin firma) siguen buscando entre los negocios, como antes.
    const url = new URL(req.url);
    const firmado = firmaValida(url.searchParams.get("t"), url.searchParams.get("s")) ? url.searchParams.get("t") : null;

    let paymentData: any = null;
    let usedToken: string = "";

    if (firmado) {
      const cred = await cargarCredencialAbono(supabase, firmado);
      if (cred.token) {
        const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, { headers: { Authorization: `Bearer ${cred.token}` } });
        if (res.ok) { paymentData = await res.json(); usedToken = cred.token; }
      }
    } else {
      const { data: allSettings } = await supabase
        .from("tenant_settings")
        .select("tenant_id, mp_access_token")
        .not("mp_access_token", "is", null);
      for (const setting of allSettings || []) {
        if (!setting.mp_access_token) continue;
        const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
          headers: { Authorization: `Bearer ${setting.mp_access_token}` },
        });
        if (res.ok) {
          paymentData = await res.json();
          usedToken = setting.mp_access_token;
          break;
        }
      }
    }

    if (!paymentData) {
      console.error("Deposit webhook: payment not found", paymentId);
      return NextResponse.json({ ok: true });
    }

    // Only process approved payments
    if (paymentData.status !== "approved") {
      console.log("Deposit webhook: payment not approved yet", paymentData.status, paymentData.status_detail);
      // Se deja constancia del intento y del MOTIVO que dio Mercado Pago (ej. rechazado:cc_rejected_other_reason), para poder diagnosticar un pago que no pasa.
      try {
        let tid: string | null = firmado;
        let monto = Math.round(Number(paymentData.transaction_amount) || 0);
        const ref = await leerIntento(supabase, paymentData.external_reference).catch(() => null);
        if (ref) { tid = tid || ref.tenantId || null; monto = Math.round(Number(ref.depositAmount) || monto); }
        if (tid) {
          await supabase.from("booking_deposits").upsert({ tenant_id: tid, payment_id: String(paymentId), amount: monto, status: `${paymentData.status}:${paymentData.status_detail || "sin_detalle"}`.slice(0, 120), payer_email: paymentData.payer?.email || null }, { onConflict: "payment_id" }).then(() => {}, () => {});
        }
      } catch { /* solo diagnostico */ }
      return NextResponse.json({ ok: true });
    }

    // Datos de la reserva: la referencia del pago es un id corto que apunta a booking_intents (o, en pagos antiguos, el JSON completo).
    const bookingData: any = await leerIntento(supabase, paymentData.external_reference).catch(() => null);
    if (!bookingData) {
      console.error("Deposit webhook: no se encontraron los datos de la reserva", paymentData.external_reference);
      return NextResponse.json({ ok: true });
    }

    const {
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
      tenantId,
      holdRef,
    } = bookingData;

    // El negocio de la reserva tiene que ser el del aviso firmado (no se puede usar el pago de un negocio para reservar en otro).
    if (firmado && tenantId !== firmado) {
      console.error("Deposit webhook: el negocio de la reserva no coincide con el del aviso", paymentId);
      return NextResponse.json({ ok: true });
    }
    // Mercado Pago avisa varias veces del mismo pago y a veces JUNTAS: el primer aviso reserva el pago y los demás se descartan
    // (antes dos avisos simultáneos se tropezaban y generaban un «choque» falso).
    const { data: yaCreada } = await supabase.from("appointments").select("id").eq("deposit_payment_id", String(paymentId)).limit(1).maybeSingle();
    if (yaCreada) return NextResponse.json({ ok: true });
    const reclamado = await reclamarPago(supabase, { tenantId, paymentId: String(paymentId), amount: Number(depositAmount) || 0, email: clientEmail || null });
    if (!reclamado) return NextResponse.json({ ok: true });

    // El bloqueo del horario cumplió su trabajo: se libera para poder crear la cita en ese mismo horario.
    await liberarHold(supabase, holdRef);
    // Si el bloqueo ya había vencido y otra persona tomó el horario, no se crea una cita encima de otra:
    // el abono queda registrado «por devolver» y se avisa al negocio.
    // La hora llega como «2026-11-05T15:00:00» (hora de pared de Chile): se lee sin convertir zonas (antes se pegaba la fecha dos veces y la fecha quedaba invalida).
    const horaTexto = /^\d{4}-\d{2}-\d{2}T/.test(String(startTime)) ? String(startTime) : `${date}T${startTime}`;
    const resuelto = await resolverServicios(supabase, barberId, tenantId, serviceIds).catch(() => null);
    try {
      const ini = parseWallClock(horaTexto);
      const fin = new Date(ini.getTime() + (resuelto?.duracion || 30) * 60000);
      const libre = await horarioLibreTrasPago(supabase, { barberId, tenantId, date, start: ini, end: fin });
      if (!libre) {
        await supabase.from("booking_deposits").upsert({ tenant_id: tenantId, payment_id: String(paymentId), appointment_id: null, amount: Math.round(Number(depositAmount) || 0), status: "needs_refund", payer_email: clientEmail || null }, { onConflict: "payment_id" }).then(() => {}, () => {});
        await notify({ tenantId, kind: "deposit_conflict", roles: ["admin", "receptionist"], title: "Abono pagado, pero el horario se ocupó", body: `${clientName} pagó $${Number(depositAmount).toLocaleString("es-CL")} para el ${date} a las ${horaTexto.slice(11, 16)}, pero ese horario ya no estaba libre. Hay que devolverle el abono o darle otra hora.`, url: "/dashboard/abonos" }).catch(() => {});
        await marcarResultado(supabase, paymentData.external_reference, bookingData, { resultado: "conflicto" });
        return NextResponse.json({ ok: true });
      }
    } catch (e) { console.error("Deposit webhook: no se pudo revisar el horario", e); }

    // Find or create client
    let clientId: string | null = null;
    if (clientEmail) {
      // Fix: this lookup had no tenant_id filter, so a deposit for Estudio Levels could
      // match (and link to) a client with the same email from a different business —
      // cross-tenant data mixing. Scoped to tenantId now, same pattern as public/book.
      let dupQuery = supabase.from("clients").select("id").eq("email", clientEmail);
      if (tenantId) dupQuery = dupQuery.eq("tenant_id", tenantId);
      const { data: existingClient } = await dupQuery.order("created_at", { ascending: true }).limit(1).maybeSingle();

      if (existingClient) {
        clientId = existingClient.id;
        if (clientPhone) {
          await supabase.from("clients").update({ phone: clientPhone }).eq("id", clientId);
        }
      } else {
        // Punto 10 (Pablo): cliente nuevo creado al pagar el deposito de una reserva por
        // link -> origen "link". Solo se marca al CREAR el cliente.
        const { data: newClient } = await supabase
          .from("clients")
          .insert({ name: clientName, email: clientEmail, phone: clientPhone || null, tenant_id: tenantId, acquisition_source: "link" })
          .select("id")
          .single();
        clientId = newClient?.id || null;
      }
    } else {
      const { data: newClient } = await supabase
        .from("clients")
        .insert({ name: clientName, phone: clientPhone || null, tenant_id: tenantId, acquisition_source: "link" })
        .select("id")
        .single();
      clientId = newClient?.id || null;
    }

    // Calculate end time
    const { data: services } = await supabase
      .from("services")
      .select("duration")
      .in("id", serviceIds);

    const totalDuration = resuelto?.duracion || (services || []).reduce((sum, s) => sum + (s.duration || 30), 0);
    const startDate = parseWallClock(horaTexto);
    const endDate = new Date(startDate.getTime() + totalDuration * 60 * 1000);

    // Create confirmed appointment with deposit info
    const { data: appointment, error: apptError } = await supabase
      .from("appointments")
      .insert({
        client_id: clientId,
        barber_id: barberId,
        date,
        start_time: startDate.toISOString(),
        end_time: endDate.toISOString(),
        status: "confirmed",
        notes: notes || null,
        tenant_id: tenantId,
        deposit_amount: depositAmount,
        deposit_status: "paid",
        deposit_payment_id: String(paymentId),
        deposit_paid_at: new Date().toISOString(),
        source: "link", // Punto 10: tambien es una reserva publica (con deposito via MP).
      })
      .select("id")
      .single();

    if (apptError) {
      console.error("Deposit webhook: error creating appointment", apptError);
      return NextResponse.json({ ok: true });
    }

    // Si dos personas reservaron este horario casi al mismo tiempo, la cita creada ÚLTIMO pierde: se borra y el abono queda «por devolver».
    if (appointment) {
      try {
        const { data: mia } = await supabase.from("appointments").select("created_at").eq("id", appointment.id).maybeSingle();
        const perdio = await perdioCarrera(supabase, { appointmentId: appointment.id, createdAt: mia?.created_at || new Date().toISOString(), barberId, tenantId, date, start: startDate, end: endDate });
        if (perdio) {
          await supabase.from("appointments").delete().eq("id", appointment.id);
          await supabase.from("booking_deposits").upsert({ tenant_id: tenantId, payment_id: String(paymentId), appointment_id: null, amount: Math.round(Number(depositAmount) || 0), status: "needs_refund", payer_email: clientEmail || null }, { onConflict: "payment_id" }).then(() => {}, () => {});
          await notify({ tenantId, kind: "deposit_conflict", roles: ["admin", "receptionist"], title: "Abono pagado, pero el horario se ocupó", body: `${clientName} pagó $${Number(depositAmount).toLocaleString("es-CL")} para el ${date} a las ${horaTexto.slice(11, 16)}, pero otra persona tomó ese horario al mismo tiempo. Hay que devolverle el abono o darle otra hora.`, url: "/dashboard/abonos" }).catch(() => {});
          await marcarResultado(supabase, paymentData.external_reference, bookingData, { resultado: "conflicto" });
          return NextResponse.json({ ok: true });
        }
      } catch (e) { console.error("Deposit webhook: no se pudo revisar el cruce de horarios", e); }
    }
    if (appointment) await marcarResultado(supabase, paymentData.external_reference, bookingData, { resultado: "pagado", appointmentId: appointment.id });
    // Registro del abono recibido (historial y control de duplicados). Si aun no esta la migracion 131, se omite.
    if (appointment) {
      await supabase.from("booking_deposits").upsert({ tenant_id: tenantId, payment_id: String(paymentId), appointment_id: appointment.id, amount: Math.round(Number(depositAmount) || 0), status: "approved", payer_email: clientEmail || null }, { onConflict: "payment_id" }).then(() => {}, () => {});
    }

    // Create appointment_services
    if (appointment) {
      const { data: serviceDetails } = await supabase
        .from("services")
        .select("id, price")
        .in("id", serviceIds);

      const serviceInserts = (serviceDetails || []).map((s) => ({
        appointment_id: appointment.id,
        service_id: s.id,
        price: s.price,
      }));

      await supabase.from("appointment_services").insert(serviceInserts);
    }

    // Log in audit
    await supabase.from("audit_log").insert({
      action: "deposit_paid",
      entity_type: "appointment",
      entity_id: appointment?.id || "",
      description: `Abono $${depositAmount.toLocaleString("es-CL")} pagado por ${clientName} — Cita confirmada automaticamente`,
      user_name: clientName,
      metadata: { paymentId, depositAmount, totalPrice, barberId, date },
    });

    // Send confirmation email (cuenta contra el cupo de correos del negocio, igual que en
    // /api/public/book).
    if (clientEmail) {
      try {
        const allowed = !tenantId || (await tryConsumeQuota(tenantId, "email", "confirmation"));
        if (allowed) {
          const { data: barber } = await supabase.from("profiles").select("name").eq("id", barberId).single();
          const { sendBookingConfirmation } = await import("@/lib/resend");
          const { plazoValido } = await import("@/lib/cambio-cliente");
          let { data: negocioMail } = await supabase.from("tenants").select("logo_url, phone, client_change_hours").eq("id", tenantId).maybeSingle();
          if (!negocioMail) negocioMail = (await supabase.from("tenants").select("logo_url, phone").eq("id", tenantId).maybeSingle()).data as any;
          const serviceNames = (await supabase.from("services").select("name").in("id", serviceIds)).data?.map((s) => s.name).join(" + ") || "";

          await sendBookingConfirmation({
            to: clientEmail,
            clientName,
            barberName: barber?.name || "Tu profesional",
            serviceName: serviceNames,
            date: startDate,   // la hora real de la cita (antes se mandaba un texto y el correo salía con «Invalid Date»)
            duration: totalDuration,
            price: totalPrice,
            appointmentId: appointment?.id || "",
            businessLogoUrl: negocioMail?.logo_url || null,
            businessPhone: negocioMail?.phone || null,
            changeHours: plazoValido(negocioMail?.client_change_hours) ?? 2,
          });
        } else {
          console.warn(`Cupo de correos agotado para tenant ${tenantId}, no se envia confirmacion (deposito) a ${clientEmail}`);
        }
      } catch (e) {
        console.error("Error sending confirmation email:", e);
      }
    }

    // Notify the barber (and the business's reception/admins) by push. Deposit bookings
    // create the appointment straight from this webhook, and previously this path never
    // fired a push — so a professional booked via a paid deposit got no alert. Mirror the
    // same notification the public/dashboard booking flows send.
    try {
      const { data: barberRow } = await supabase.from("profiles").select("name, email").eq("id", barberId).single();
      const startDateForMsg = new Date(startDate);
      await notify({
        tenantId, kind: "appointment_new", professionalId: barberId,
        userIds: [barberId],
        roles: ["admin", "receptionist"],
        title: "Nueva Cita Agendada",
        body: `${clientName} - ${apptDayLabel(String(date))} ${startDateForMsg.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })} con ${barberRow?.name || "Profesional"}`,
        url: appointment?.id ? apptNoticeUrl(appointment.id, String(date)) : "/dashboard/calendario",
      });
      // Email the barber too (works even without browser notifications).
      if (barberRow?.email) {
        const { sendBarberNewAppointment } = await import("@/lib/resend");
        const svcNames = (await supabase.from("services").select("name").in("id", serviceIds)).data?.map((s) => s.name).join(" + ") || "Servicio";
        await sendBarberNewAppointment({
          to: barberRow.email,
          barberName: barberRow.name || "Profesional",
          clientName,
          serviceName: svcNames,
          date: startDateForMsg,
        });
      }
    } catch (e) {
      console.error("Error notifying barber (deposit booking):", e);
    }

    return NextResponse.json({ ok: true, appointmentId: appointment?.id });
  } catch (error: any) {
    console.error("Deposit webhook error:", error);
    return NextResponse.json({ ok: true }); // Always return 200 to MP
  }
}
