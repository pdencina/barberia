import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";

// Returns WhatsApp links for tomorrow's appointments (for manual batch sending)
export async function GET(req: NextRequest) {
  const supabase = createAdminSupabase();
  const { searchParams } = new URL(req.url);
  
  // Accept date param from frontend (more reliable than server-side timezone calc)
  let tomorrowStr = searchParams.get("date");
  
  if (!tomorrowStr) {
    // Fallback: calculate tomorrow in Chile time
    const now = new Date();
    const chileTime = new Date(now.toLocaleString("en-US", { timeZone: "America/Santiago" }));
    chileTime.setDate(chileTime.getDate() + 1);
    tomorrowStr = chileTime.toISOString().split("T")[0];
  }

  const { data: appointments } = await supabase
    .from("appointments")
    .select(`
      id, start_time,
      client:clients(name, phone),
      barber:profiles(name),
      services:appointment_services(
        service:services(name)
      )
    `)
    .eq("date", tomorrowStr)
    .in("status", ["scheduled", "confirmed"])
    .order("start_time");

  if (!appointments) return NextResponse.json([]);

  const bookingUrl = process.env.NEXT_PUBLIC_APP_URL || "https://barberia-kappa-weld.vercel.app";

  const links = (appointments || [])
    .map((a: any) => {
      const client = a.client;
      const barber = a.barber;
      const services = (a.services || []).map((s: any) => s.service?.name).filter(Boolean).join(", ");
      const timeMatch = a.start_time?.match(/(\d{2}:\d{2})/);
      const time = timeMatch ? timeMatch[1] : "";

      const phone = client?.phone?.replace(/\D/g, "")?.replace(/^0/, "56") || "";
      const whatsappPhone = phone.startsWith("56") ? phone : `56${phone}`;

      const message = `Hola ${client?.name || ""}! Te recordamos tu cita de manana:\n\n` +
        `Servicio: ${services}\n` +
        `Profesional: ${barber?.name || "Tu profesional"}\n` +
        `Hora: ${time}\n\n` +
        `Te esperamos!\n` +
        `Si necesitas cancelar: 9 4266 6172`;

      return {
        appointmentId: a.id,
        clientName: client?.name || "Sin cliente",
        phone: client?.phone || null,
        time,
        service: services,
        barber: barber?.name,
        whatsappUrl: phone ? `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(message)}` : null,
      };
    });

  return NextResponse.json(links);
}
