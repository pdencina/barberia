import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";

// Returns WhatsApp links for tomorrow's appointments (for manual batch sending)
export async function GET() {
  const supabase = createAdminSupabase();

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split("T")[0];

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

  const links = appointments
    .filter((a: any) => a.client?.phone)
    .map((a: any) => {
      const client = a.client;
      const barber = a.barber;
      const services = (a.services || []).map((s: any) => s.service?.name).filter(Boolean).join(", ");
      const time = new Date(a.start_time).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });

      const phone = client.phone.replace(/\D/g, "").replace(/^0/, "56");
      const whatsappPhone = phone.startsWith("56") ? phone : `56${phone}`;

      const message = `Hola ${client.name}! Te recordamos tu cita de manana:\n\n` +
        `Servicio: ${services}\n` +
        `Barbero: ${barber?.name || "EstudioLevels"}\n` +
        `Hora: ${time}\n\n` +
        `Te esperamos en EstudioLevels!\n` +
        `Si necesitas cancelar: 9 4266 6172`;

      return {
        appointmentId: a.id,
        clientName: client.name,
        phone: client.phone,
        time,
        service: services,
        barber: barber?.name,
        whatsappUrl: `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(message)}`,
      };
    });

  return NextResponse.json(links);
}
