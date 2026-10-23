import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, resolveTenantForRequest } from "@/lib/supabase/server";
import { tenantBookingUrl, tenantLogoUrl } from "@/lib/retention";
import { buildRetentionEmail } from "@/lib/resend";
import { buildRetentionWhatsApp } from "@/lib/retention-message";

// Vista previa de lo que recibira el cliente (WhatsApp y correo) con el cupon y el mensaje elegidos. No envia nada ni gasta cupo.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({} as any));
  const { tenantId } = await resolveTenantForRequest(null);
  if (!tenantId || tenantId === "ALL") return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const supabase = createAdminSupabase();
  const bookingUrl = await tenantBookingUrl(supabase, tenantId);
  const businessLogoUrl = await tenantLogoUrl(supabase, tenantId);

  let coupon: any = null;
  if (body.couponCode) {
    const { data } = await supabase.from("coupons").select("code, description, discount_type, discount_value")
      .eq("code", String(body.couponCode).toUpperCase()).eq("tenant_id", tenantId).maybeSingle();
    coupon = data || null;
  }
  const clientName = String(body.clientName || "").trim().slice(0, 80) || "Cliente";
  const message = String(body.message || "").slice(0, 600);

  const whatsapp = buildRetentionWhatsApp({ clientName, message, coupon, bookingUrl });
  const email = buildRetentionEmail({
    to: "", clientName, message: message.trim() || "Te extrañamos! Vuelve pronto.",
    couponCode: coupon?.code || null, couponDescription: coupon?.description || null,
    discountType: coupon?.discount_type || null, discountValue: coupon ? Number(coupon.discount_value) : null, bookingUrl, businessLogoUrl,
  });
  return NextResponse.json({ whatsapp, emailSubject: email.subject, emailHtml: email.html });
}
