import { armarEnlacesCorreo, type TenantLinks } from "@/lib/post-service-links";
import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";
import { verifyCron } from "@/lib/cron-auth";
import { tryConsumeQuota } from "@/lib/message-quota";

export const dynamic = "force-dynamic";

// GET: Send post-service thank you email + review request
// Called by cron every hour — checks for appointments completed in the last 2 hours
export async function GET(req: NextRequest) {
  const denied = verifyCron(req);
  if (denied) return denied;

  const supabase = createAdminSupabase();

  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const now = new Date().toISOString();

  // Get recently completed appointments that haven't received the post-service email
  const { data: appointments } = await supabase
    .from("appointments")
    .select(`
      id, date, start_time, tenant_id,
      client:clients(id, name, email, phone),
      barber:profiles(name),
      services:appointment_services(service:services(name))
    `)
    .eq("status", "completed")
    .eq("post_service_sent", false)
    .gte("updated_at", twoHoursAgo)
    .lte("updated_at", now);

  if (!appointments || appointments.length === 0) {
    return NextResponse.json({ sent: 0, message: "No completed appointments to follow up" });
  }

  // Link de Google Maps y de reserva de cada negocio (si falta la columna, se usa la pagina interna de reseñas).
  const tenantLinks = new Map<string, TenantLinks>();
  const tenantIds = Array.from(new Set(appointments.map((a: any) => a.tenant_id).filter(Boolean)));
  if (tenantIds.length > 0) {
    let ts: any[] | null = null;
    for (const cols of ["id, slug, google_maps_url, google_place_id", "id, slug, google_maps_url", "id, slug"]) {
      const r: { data: any[] | null; error: any } = await supabase.from("tenants").select(cols).in("id", tenantIds);
      if (!r.error) { ts = r.data; break; }
    }
    for (const t of ts || []) tenantLinks.set(t.id, { slug: (t as any).slug, google_maps_url: (t as any).google_maps_url, google_place_id: (t as any).google_place_id });
  }

  let sent = 0;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.re-booking.cl";

  for (const appt of appointments) {
    const client = appt.client as any;
    const barber = appt.barber as any;
    const services = (appt.services as any[])?.map((s: any) => s.service?.name).join(" + ") || "Servicio";

    if (!client?.email) continue;
    const links = armarEnlacesCorreo(appUrl, tenantLinks.get(appt.tenant_id), appt.id);

    // Cuenta contra el cupo de correos del negocio (antes no contaba). Si no hay cupo no se envia, y se marca como
    // atendida para que el cron no la reintente cada hora.
    if (appt.tenant_id && !(await tryConsumeQuota(appt.tenant_id, "email", "followup", appt.id))) {
      await supabase.from("appointments").update({ post_service_sent: true }).eq("id", appt.id);
      continue;
    }

    try {
      const { getResendClient } = await import("@/lib/resend-client");
      const resend = getResendClient();

      await resend.emails.send({
        from: process.env.EMAIL_FROM || "re-booking <no-reply@re-booking.cl>",
        to: client.email,
        subject: links.subject,
        html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; background: #F5F7FA;">
  <div style="background: white; border-radius: 16px; padding: 32px; border: 1px solid #e5e7eb;">
    <div style="text-align: center; margin-bottom: 24px;">
      <h1 style="color: #1F2937; margin: 0; font-size: 22px;">Gracias por tu visita! 🙌</h1>
    </div>

    <p style="color: #1F2937; font-size: 15px;">Hola <strong>${client.name}</strong>,</p>
    <p style="color: #6B7280; font-size: 14px; line-height: 1.6;">
      Esperamos que hayas disfrutado tu experiencia con <strong>${barber?.name || "nosotros"}</strong>.
      ${links.intro}
    </p>

    <div style="background: #F5F7FA; border-radius: 12px; padding: 16px; margin: 20px 0; text-align: center;">
      <p style="margin: 0 0 4px; font-size: 13px; color: #6B7280;">Servicio:</p>
      <p style="margin: 0; font-size: 16px; font-weight: bold; color: #1F2937;">${services}</p>
      <p style="margin: 8px 0 0; font-size: 12px; color: #6B7280;">${new Date(appt.date + "T12:00:00").toLocaleDateString("es-CL", { day: "numeric", month: "long" })} · ${barber?.name}</p>
    </div>

    <div style="text-align: center; margin: 24px 0;">
      <a href="${links.reviewUrl}" style="display: inline-block; background: #0F8B8D; color: white; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-weight: bold; font-size: 15px;">
        ${links.reviewLabel}
      </a>
    </div>

    <p style="color: #6B7280; font-size: 12px; text-align: center;">
      Tambien puedes agendar tu proxima visita:
    </p>
    <div style="text-align: center; margin-top: 12px;">
      <a href="${links.bookUrl}" style="color: #0F8B8D; font-size: 13px; font-weight: bold; text-decoration: none;">
        Agendar nueva cita →
      </a>
    </div>

    <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e7eb; text-align: center;">
      <p style="color: #6B7280; font-size: 11px; margin: 0;">re-booking · Todo tu negocio. Un solo sistema.</p>
    </div>
  </div>
</body>
</html>`,
      });

      // Mark as sent
      await supabase
        .from("appointments")
        .update({ post_service_sent: true })
        .eq("id", appt.id);

      sent++;
    } catch (e) {
      console.error(`Error sending post-service email to ${client.email}:`, e);
    }
  }

  return NextResponse.json({ sent, total: appointments.length });
}
