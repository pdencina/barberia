import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, resolveTenantForRequest, getCurrentUserRoleAndTenant } from "@/lib/supabase/server";
import { sendRetentionEmail } from "@/lib/resend";
import { getInactiveClients, dedupeBy, tenantBookingUrl, tenantLogoUrl, parseExcludeIds, parseIdSet, excludeClients, mergeRecipients, loadManualRecipients, type Recipient } from "@/lib/retention";
import { formatPhoneCL } from "@/lib/phone";
import { tryConsumeQuota } from "@/lib/message-quota";
import { tenantHasFeature } from "@/lib/plan-features";
import { buildRetentionWhatsApp } from "@/lib/retention-message";
import { recordCampaign, recentlyContacted, couponSnapshot, cleanCampaignName, RECENT_DAYS, type CampaignRecipientInput } from "@/lib/retention-campaigns";

// POST: Send retention message to inactive clients OF THIS BUSINESS.
//
// Two safety guards after the incident where a business with 9 clients emailed 647
// people from OTHER businesses with no confirmation:
//   1. Tenant scoping is MANDATORY. Without a concrete tenant (or for a super_admin's
//      "ALL"), we refuse — a bulk send must never run across every business.
//   2. `preview: true` returns the recipient list WITHOUT sending, so the UI can show a
//      confirmation with a sample before anything goes out.
export async function POST(req: NextRequest) {
  const supabase = createAdminSupabase();
  const body = await req.json();
  const { days, couponCode, message, type, preview, includeNever, maxDays } = body; // type: 'email' | 'whatsapp'

  // Resolve and REQUIRE a single tenant. This is the fix for the cross-business leak:
  // the query below used to hit every client of every business (service-role bypasses
  // RLS). "ALL" (super_admin) is rejected too — a mass send must target one business.
  // SEGURIDAD: nunca confiar directo en el tenantId de la URL — resolveTenantForRequest lo
  // reemplaza por el negocio real del usuario logueado salvo que sea super_admin.
  const { searchParams } = new URL(req.url);
  const { tenantId } = await resolveTenantForRequest(searchParams.get("tenantId"));
  if (!tenantId || tenantId === "ALL") {
    return NextResponse.json(
      { error: "No se pudo identificar el negocio. Recarga la pagina e intenta de nuevo." },
      { status: 400 }
    );
  }

  // Item 34 (Nico, 26-sep): "Mensajes masivos" es feature de plan (Starter+, Basic no la
  // incluye). Se corta antes del preview tambien — si el plan no lo tiene, no hay nada que
  // previsualizar.
  if (!(await tenantHasFeature(tenantId, "whatsapp_bulk"))) {
    return NextResponse.json({ error: "Los mensajes masivos no estan incluidos en tu plan actual. Mejora tu plan para usarlos." }, { status: 403 });
  }

  // "Quien esta inactivo" sale de la MISMA funcion que usa la pantalla de Retencion
  // (lib/retention): mismo corte de dias, misma ventana desde el inicio real del negocio y
  // sin clientes que ya tienen una cita por venir.
  const { inactive: allInactive } = await getInactiveClients(supabase, tenantId, Number.isFinite(Number(days)) ? Math.max(0, Number(days)) : 30, { includeNever: includeNever === true, maxDays: Number(maxDays) > 0 ? Number(maxDays) : null });
  // Quienes se desmarcaron en la pantalla (casilla de cada cliente) no reciben el mensaje ni el cupon.
  // Clientes agregados a mano (buscados en la pantalla): se suman a la lista aunque no esten en el rango, solo si son de este negocio y aceptan promociones.
  const includeIds = parseIdSet(body.includeClientIds, 500);
  const manual = includeIds.size > 0 ? await loadManualRecipients(supabase, tenantId, includeIds) : { recipients: [] as Recipient[], skippedOptedOut: 0 };
  const calculated: Recipient[] = allInactive.map((c) => ({ id: c.id, name: c.name, email: c.email, phone: c.phone }));
  const merged = mergeRecipients(calculated, manual.recipients);
  const inactiveClients = excludeClients(merged, parseExcludeIds(body.excludeClientIds));
  const excludedCount = merged.length - inactiveClients.length;
  // Para el historial: quien envio y los datos de la campana (el registro nunca bloquea ni rompe un envio).
  const caller = preview ? null : await getCurrentUserRoleAndTenant();
  let callerName: string | null = null;
  if (caller?.userId) {
    const { data: prof } = await supabase.from("profiles").select("name").eq("id", caller.userId).maybeSingle();
    callerName = (prof as any)?.name || null;
  }
  const campaignBase = {
    tenantId, userId: caller?.userId || null, userName: callerName,
    name: cleanCampaignName(body.campaignName),
    message: typeof message === "string" && message.trim() ? message.trim().slice(0, 600) : null,
    couponCode: null as string | null, couponDetail: null as string | null,
    rangeMinDays: Number.isFinite(Number(days)) ? Math.max(0, Number(days)) : 30,
    rangeMaxDays: Number.isFinite(Number(maxDays)) && Number(maxDays) > 0 ? Number(maxDays) : null,
    includeNever: includeNever === true, excludedCount, manualCount: manual.recipients.length,
  };
  const bookingUrl = await tenantBookingUrl(supabase, tenantId);
  const businessLogoUrl = await tenantLogoUrl(supabase, tenantId);

  // Detalle del cupon (del propio negocio) para el correo: sin esto el correo decia
  // "$undefined de descuento" porque solo se enviaba el codigo.
  let coupon: { code: string; description: string | null; discount_type: string; discount_value: number } | null = null;
  if (couponCode) {
    const { data: c } = await supabase
      .from("coupons")
      .select("code, description, discount_type, discount_value")
      .eq("code", String(couponCode).toUpperCase())
      .eq("tenant_id", tenantId)
      .single();
    coupon = c || null;
  }
  campaignBase.couponCode = coupon?.code || null;
  campaignBase.couponDetail = couponSnapshot(coupon);

  // A cada destinatario de la vista previa se le agrega si ya recibio una campana hace poco (para no repetirle lo mismo).
  const withRecentInfo = async <T extends { id: string }>(list: T[]) => {
    const recent = await recentlyContacted(supabase, tenantId, list.map((r) => r.id));
    return list.map((r) => ({ ...r, last: recent.get(r.id) ? { at: recent.get(r.id)!.at, coupon: recent.get(r.id)!.couponCode } : null }));
  };

  if (type === "email") {
    // Un solo correo por direccion: dos fichas con el mismo email no reciben doble mensaje
    // (ni gastan cupo dos veces).
    const withEmail = dedupeBy(inactiveClients.filter((c) => c.email), (c) => c.email!.trim().toLowerCase());

    // Preview mode: return who WOULD receive it + a small sample, send nothing.
    if (preview) {
      return NextResponse.json({
        preview: true,
        total: withEmail.length,
        sample: withEmail.slice(0, 5).map((c) => ({ name: c.name, email: c.email })),
        // Lista completa para el cuadro de revision (con su id, para poder quitar a alguien antes de enviar).
        recipients: await withRecentInfo(withEmail.slice(0, 3000).map((c) => ({ id: c.id, name: c.name, contact: c.email }))),
        recentDays: RECENT_DAYS,
        manualSkipped: manual.skippedOptedOut,
      });
    }

    // Cuenta contra el cupo de correos del negocio (Nico, 27-sep: envios masivos de
    // retencion si cuentan). Se detiene apenas se agota — el resto queda sin enviar y se
    // informa en la respuesta.
    let sent = 0;
    let quotaExceeded = false;
    const results: CampaignRecipientInput[] = [];
    for (const client of withEmail) {
      const allowed = await tryConsumeQuota(tenantId, "email", "retention");
      if (!allowed) {
        quotaExceeded = true;
        break;
      }
      try {
        await sendRetentionEmail({
          to: client.email!,
          clientName: client.name,
          message: message || "Te extrañamos! Vuelve pronto.",
          couponCode: coupon?.code || null,
          couponDescription: coupon?.description || null,
          discountType: coupon?.discount_type || null,
          discountValue: coupon ? Number(coupon.discount_value) : null,
          bookingUrl,
          businessLogoUrl,
        });
        sent++;
        results.push({ clientId: client.id, name: client.name, contact: client.email, status: "sent" });
      } catch (e) {
        console.error(`Error sending to ${client.email}:`, e);
        results.push({ clientId: client.id, name: client.name, contact: client.email, status: "failed" });
      }
    }

    // Historial: queda registrado que se envio, con que cupon y a quien (no bloquea la respuesta si falla).
    await recordCampaign(supabase, {
      ...campaignBase, channel: "email", plannedTotal: withEmail.length, sentCount: sent,
      failedCount: results.filter((r) => r.status === "failed").length, quotaExceeded, recipients: results,
    });

    return NextResponse.json({ success: true, sent, total: withEmail.length, quotaExceeded });
  }

  if (type === "whatsapp") {
    const withPhone = dedupeBy(inactiveClients.filter((c) => c.phone), (c) => formatPhoneCL(c.phone!));

    if (preview) {
      return NextResponse.json({
        preview: true,
        total: withPhone.length,
        sample: withPhone.slice(0, 5).map((c) => ({ name: c.name, phone: c.phone })),
        recipients: await withRecentInfo(withPhone.slice(0, 3000).map((c) => ({ id: c.id, name: c.name, contact: formatPhoneCL(c.phone!) }))),
        recentDays: RECENT_DAYS,
        manualSkipped: manual.skippedOptedOut,
      });
    }

    // Cada link generado aqui cuenta contra el cupo de WhatsApp del negocio (es un envio
    // masivo deliberado, no una recarga de pantalla como en /cron/reminders/whatsapp, asi
    // que no hace falta el dedup por referenceId — cada ejecucion de este boton es una
    // tanda nueva de mensajes). Se corta la lista apenas se agota el cupo.
    const links: Array<{ name: string; phone: string | null; url: string }> = [];
    const results: CampaignRecipientInput[] = [];
    let quotaExceeded = false;
    for (const c of withPhone) {
      const allowed = await tryConsumeQuota(tenantId, "whatsapp", "retention");
      if (!allowed) {
        quotaExceeded = true;
        break;
      }
      const phone = c.phone!.replace(/\D/g, "").replace(/^0/, "56");
      const whatsappPhone = phone.startsWith("56") ? phone : `56${phone}`;
      const msg = buildRetentionWhatsApp({ clientName: c.name, message, coupon: coupon as any, bookingUrl });

      links.push({
        name: c.name,
        phone: c.phone,
        url: `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(msg)}`,
      });
      results.push({ clientId: c.id, name: c.name, contact: formatPhoneCL(c.phone!), status: "sent" });
    }

    // Historial de la lista de difusion preparada (cada contacto descuenta cupo igual que un envio).
    await recordCampaign(supabase, {
      ...campaignBase, channel: "whatsapp", plannedTotal: withPhone.length, sentCount: links.length, failedCount: 0, quotaExceeded, recipients: results,
    });

    return NextResponse.json({ success: true, links, total: links.length, quotaExceeded });
  }

  return NextResponse.json({ error: "Tipo invalido" }, { status: 400 });
}
