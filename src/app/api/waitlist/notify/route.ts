import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";
import { authorizeWaitlistEntry } from "@/lib/waitlist-access";
import { tryConsumeQuota } from "@/lib/message-quota";

// Notify waitlisted clients that a slot opened up
export async function POST(req: NextRequest) {
  const supabase = createAdminSupabase();
  const body = await req.json();
  const { waitlistId, type } = body; // type: "email" | "whatsapp"
  const access = await authorizeWaitlistEntry(waitlistId);
  if (!access.ok) return access.response;

  const { data: entry } = await supabase
    .from("waitlist")
    .select("*, service:services(name), barber:profiles(name)")
    .eq("id", waitlistId)
    .single();

  if (!entry) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const bookingUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.re-booking.cl";

  // Estos avisos también cuentan en el cupo mensual de mensajes del plan (antes salían sin límite). El negocio se deduce del profesional o del servicio.
  let tenantDeLaLista: string | null = null;
  if ((entry as any).barber_id) tenantDeLaLista = ((await supabase.from("profiles").select("tenant_id").eq("id", (entry as any).barber_id).maybeSingle()).data as any)?.tenant_id || null;
  if (!tenantDeLaLista && (entry as any).service_id) tenantDeLaLista = ((await supabase.from("services").select("tenant_id").eq("id", (entry as any).service_id).maybeSingle()).data as any)?.tenant_id || null;
  if ((type === "email" || type === "whatsapp") && tenantDeLaLista) {
    const ok = await tryConsumeQuota(tenantDeLaLista, type === "email" ? "email" : "whatsapp", "reminder", `waitlist:${waitlistId}:${type}`);
    if (!ok) return NextResponse.json({ error: "Ya usaste todos los mensajes de este mes de tu plan. Mejora tu plan o espera al próximo ciclo." }, { status: 429 });
  }

  if (type === "whatsapp" && entry.client_phone) {
    const phone = entry.client_phone.replace(/\D/g, "").replace(/^0/, "56");
    const whatsappPhone = phone.startsWith("56") ? phone : `56${phone}`;

    const message = `Hola ${entry.client_name}! Se libero una hora para el ${new Date(entry.preferred_date).toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long" })}.\n\n` +
      (entry.service ? `Servicio: ${(entry as any).service?.name}\n` : "") +
      (entry.barber ? `Profesional: ${(entry as any).barber?.name}\n` : "") +
      `\nAgenda aqui antes de que se ocupe: ${bookingUrl}/booking\n\n` +
      `Te esperamos!`;

    const url = `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(message)}`;

    // Mark as notified
    await supabase.from("waitlist").update({ status: "notified", notified_at: new Date().toISOString() }).eq("id", waitlistId);

    return NextResponse.json({ success: true, channel: "whatsapp", url });
  }

  if (type === "email" && entry.client_email) {
    // Send via Resend
    const { sendRetentionEmail } = await import("@/lib/resend");
    try {
      await sendRetentionEmail({
        to: entry.client_email,
        clientName: entry.client_name,
        message: `Se libero una hora para el ${new Date(entry.preferred_date).toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long" })}. Agenda ahora antes de que se ocupe!`,
        couponCode: null,
        couponDescription: null,
        discountType: null,
        discountValue: null,
      });

      await supabase.from("waitlist").update({ status: "notified", notified_at: new Date().toISOString() }).eq("id", waitlistId);
      return NextResponse.json({ success: true, channel: "email" });
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "Sin contacto disponible" }, { status: 400 });
}
