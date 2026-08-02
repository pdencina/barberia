import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";
import { sendRetentionEmail } from "@/lib/resend";

// POST: Send retention message to ALL inactive clients at once
export async function POST(req: NextRequest) {
  const supabase = createAdminSupabase();
  const body = await req.json();
  const { days, couponCode, message, type } = body; // type: 'email' | 'whatsapp'

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - (days || 30));

  // Get all clients
  const { data: clients } = await supabase
    .from("clients")
    .select("id, name, email, phone, created_at");

  // Get last visit per client
  const { data: appointments } = await supabase
    .from("appointments")
    .select("client_id, date")
    .eq("status", "completed")
    .order("date", { ascending: false });

  const lastVisitMap: Record<string, string> = {};
  for (const appt of appointments || []) {
    if (!lastVisitMap[appt.client_id]) lastVisitMap[appt.client_id] = appt.date;
  }

  // Filter inactive
  const inactiveClients = (clients || []).filter((c) => {
    const lastVisit = lastVisitMap[c.id];
    const referenceDate = lastVisit ? new Date(lastVisit) : new Date(c.created_at);
    return referenceDate < cutoffDate;
  });

  if (type === "email") {
    const withEmail = inactiveClients.filter((c) => c.email);
    let sent = 0;

    for (const client of withEmail) {
      try {
        await sendRetentionEmail({
          to: client.email!,
          clientName: client.name,
          message: message || "Te extrañamos! Vuelve pronto.",
          couponCode: couponCode || null,
          couponDescription: null,
          discountType: null,
          discountValue: null,
        });
        sent++;
      } catch (e) {
        console.error(`Error sending to ${client.email}:`, e);
      }
    }

    return NextResponse.json({ success: true, sent, total: withEmail.length });
  }

  if (type === "whatsapp") {
    const bookingUrl = process.env.NEXT_PUBLIC_APP_URL || "https://barberia-kappa-weld.vercel.app";
    const withPhone = inactiveClients.filter((c) => c.phone);

    const links = withPhone.map((c) => {
      const phone = c.phone!.replace(/\D/g, "").replace(/^0/, "56");
      const whatsappPhone = phone.startsWith("56") ? phone : `56${phone}`;
      let msg = message || `Hola ${c.name}! Te extrañamos.`;
      if (couponCode) msg += `\n\nUsa tu cupon: ${couponCode}`;
      msg += `\n\nAgenda: ${bookingUrl}/booking`;

      return {
        name: c.name,
        phone: c.phone,
        url: `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(msg)}`,
      };
    });

    return NextResponse.json({ success: true, links, total: links.length });
  }

  return NextResponse.json({ error: "Tipo invalido" }, { status: 400 });
}
