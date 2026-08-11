import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";

// GET: Confirm attendance from email link
export async function GET(req: NextRequest) {
  const supabase = createAdminSupabase();
  const { searchParams } = new URL(req.url);
  const appointmentId = searchParams.get("id");
  const action = searchParams.get("action");

  if (!appointmentId) {
    return new Response(htmlPage("Error", "Link invalido"), { headers: { "Content-Type": "text/html" } });
  }

  // Get appointment
  const { data: appt } = await supabase
    .from("appointments")
    .select("id, status")
    .eq("id", appointmentId)
    .single();

  if (!appt) {
    return new Response(htmlPage("Error", "Cita no encontrada"), { headers: { "Content-Type": "text/html" } });
  }

  if (action === "confirm") {
    // Mark as confirmed
    await supabase
      .from("appointments")
      .update({ status: "confirmed" })
      .eq("id", appointmentId)
      .in("status", ["scheduled", "pending"]);

    return new Response(
      htmlPage("Asistencia confirmada ✓", "Tu cita esta confirmada. Te esperamos manana!"),
      { headers: { "Content-Type": "text/html" } }
    );
  }

  return new Response(
    htmlPage("Accion no reconocida", "Usa los botones del email"),
    { headers: { "Content-Type": "text/html" } }
  );
}

function htmlPage(title: string, message: string): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title} | re-booking</title></head>
<body style="font-family: Arial, sans-serif; max-width: 400px; margin: 50px auto; padding: 20px; text-align: center; background: #F5F7FA;">
  <div style="background: white; border-radius: 16px; padding: 32px; border: 1px solid #e5e7eb;">
    <h1 style="color: #1F2937; font-size: 24px; margin-bottom: 8px;">${title}</h1>
    <p style="color: #6B7280; font-size: 15px;">${message}</p>
    <a href="/" style="display: inline-block; margin-top: 20px; padding: 10px 24px; background: #0F8B8D; color: white; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 14px;">
      Ir a re-booking
    </a>
  </div>
</body>
</html>`;
}
