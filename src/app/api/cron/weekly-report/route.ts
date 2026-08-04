import { NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// GET: Generate and send weekly AI report (called by Vercel Cron every Monday 9am)
export async function GET() {
  const supabase = createAdminSupabase();

  // Date range: last 7 days
  const now = new Date();
  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const startDate = weekAgo.toISOString().split("T")[0];
  const endDate = now.toISOString().split("T")[0];

  // Previous week for comparison
  const twoWeeksAgo = new Date(weekAgo);
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 7);
  const prevStartDate = twoWeeksAgo.toISOString().split("T")[0];

  // --- Gather metrics ---

  // Income this week
  const { data: weekTx } = await supabase
    .from("transactions")
    .select("total, payment_method")
    .eq("type", "income")
    .eq("status", "completed")
    .gte("created_at", `${startDate}T00:00:00`)
    .lte("created_at", `${endDate}T23:59:59`);

  const weekIncome = (weekTx || []).reduce((s, t) => s + Number(t.total), 0);
  const weekTxCount = weekTx?.length || 0;

  // Income previous week
  const { data: prevTx } = await supabase
    .from("transactions")
    .select("total")
    .eq("type", "income")
    .eq("status", "completed")
    .gte("created_at", `${prevStartDate}T00:00:00`)
    .lte("created_at", `${startDate}T00:00:00`);

  const prevIncome = (prevTx || []).reduce((s, t) => s + Number(t.total), 0);

  // Appointments this week
  const { count: weekAppts } = await supabase
    .from("appointments")
    .select("id", { count: "exact", head: true })
    .gte("date", startDate)
    .lte("date", endDate);

  const { count: completedAppts } = await supabase
    .from("appointments")
    .select("id", { count: "exact", head: true })
    .eq("status", "completed")
    .gte("date", startDate)
    .lte("date", endDate);

  const { count: noShows } = await supabase
    .from("appointments")
    .select("id", { count: "exact", head: true })
    .eq("status", "no_show")
    .gte("date", startDate)
    .lte("date", endDate);

  const { count: cancellations } = await supabase
    .from("appointments")
    .select("id", { count: "exact", head: true })
    .in("status", ["cancelled"])
    .gte("date", startDate)
    .lte("date", endDate);

  // New clients
  const { count: newClients } = await supabase
    .from("clients")
    .select("id", { count: "exact", head: true })
    .gte("created_at", `${startDate}T00:00:00`);

  // Top services
  const { data: serviceItems } = await supabase
    .from("transaction_items")
    .select("description, quantity")
    .not("service_id", "is", null)
    .gte("created_at", `${startDate}T00:00:00`);

  const svcMap: Record<string, number> = {};
  for (const item of serviceItems || []) {
    svcMap[item.description] = (svcMap[item.description] || 0) + (item.quantity || 1);
  }
  const topServices = Object.entries(svcMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => `${name} (${count}x)`);

  // Top barbers by income
  const { data: barberTx } = await supabase
    .from("transactions")
    .select("barber_id, total")
    .eq("type", "income")
    .eq("status", "completed")
    .gte("created_at", `${startDate}T00:00:00`);

  const barberMap: Record<string, number> = {};
  for (const t of barberTx || []) {
    if (t.barber_id) barberMap[t.barber_id] = (barberMap[t.barber_id] || 0) + Number(t.total);
  }
  const topBarberIds = Object.entries(barberMap).sort((a, b) => b[1] - a[1]).slice(0, 3);
  let topBarbers: Array<{ name: string; total: number }> = [];
  if (topBarberIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, name")
      .in("id", topBarberIds.map(([id]) => id));
    const nameMap = Object.fromEntries((profiles || []).map((p) => [p.id, p.name]));
    topBarbers = topBarberIds.map(([id, total]) => ({ name: nameMap[id] || "—", total }));
  }

  // --- Generate AI insights ---
  const incomeChange = prevIncome > 0 ? Math.round(((weekIncome - prevIncome) / prevIncome) * 100) : 0;
  const attendanceRate = (weekAppts || 0) > 0 ? Math.round(((completedAppts || 0) / (weekAppts || 1)) * 100) : 0;

  let aiInsights = "";
  const openaiKey = process.env.OPENAI_API_KEY;

  if (openaiKey) {
    try {
      const prompt = `Eres Oti, el asistente de gestión de re-booking. Genera un breve análisis semanal (3-4 bullets, máximo 150 palabras) para el dueño de un negocio con estos datos:
- Ingresos: $${weekIncome.toLocaleString("es-CL")} (${incomeChange >= 0 ? "+" : ""}${incomeChange}% vs semana anterior)
- Transacciones: ${weekTxCount}
- Citas totales: ${weekAppts}, completadas: ${completedAppts}, no-shows: ${noShows}, cancelaciones: ${cancellations}
- Tasa asistencia: ${attendanceRate}%
- Clientes nuevos: ${newClients}
- Top servicios: ${topServices.join(", ")}
- Top barberos: ${topBarbers.map((b) => `${b.name} ($${b.total.toLocaleString("es-CL")})`).join(", ")}

Da recomendaciones concretas y positivas. Usa emojis. Sé conciso y directo.`;

      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${openaiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
          max_tokens: 300,
        }),
      });
      const data = await res.json();
      aiInsights = data.choices?.[0]?.message?.content || "";
    } catch (e) {
      console.error("Error generating AI insights:", e);
    }
  }

  // Fallback if no AI
  if (!aiInsights) {
    aiInsights = `📊 Resumen: ${weekTxCount} ventas por $${weekIncome.toLocaleString("es-CL")} (${incomeChange >= 0 ? "+" : ""}${incomeChange}% vs semana anterior). ${newClients} clientes nuevos. Tasa de asistencia: ${attendanceRate}%.`;
  }

  // --- Send email ---
  const { data: admins } = await supabase
    .from("profiles")
    .select("email")
    .in("role", ["admin", "super_admin"])
    .eq("active", true);

  const recipients = (admins || []).map((a) => a.email).filter(Boolean);

  if (recipients.length > 0) {
    try {
      const { getResendClient } = await import("@/lib/resend-client");
      const resend = getResendClient();

      const formatCLP = (n: number) => `$${n.toLocaleString("es-CL")}`;

      const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #F5F7FA;">
  <div style="background: white; border-radius: 16px; padding: 32px; border: 1px solid #e5e7eb;">
    <div style="text-align: center; margin-bottom: 24px;">
      <h1 style="color: #1F2937; margin: 0; font-size: 22px;">📊 Informe Semanal</h1>
      <p style="color: #6B7280; margin: 4px 0 0; font-size: 13px;">${startDate} al ${endDate}</p>
    </div>

    <!-- Metrics -->
    <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
      <tr>
        <td style="padding: 12px; text-align: center; background: #F5F7FA; border-radius: 8px;">
          <p style="margin: 0; font-size: 24px; font-weight: bold; color: #0F8B8D;">${formatCLP(weekIncome)}</p>
          <p style="margin: 4px 0 0; font-size: 11px; color: #6B7280;">INGRESOS</p>
          <p style="margin: 2px 0 0; font-size: 11px; color: ${incomeChange >= 0 ? "#10B981" : "#EF4444"};">${incomeChange >= 0 ? "+" : ""}${incomeChange}% vs anterior</p>
        </td>
        <td style="width: 8px;"></td>
        <td style="padding: 12px; text-align: center; background: #F5F7FA; border-radius: 8px;">
          <p style="margin: 0; font-size: 24px; font-weight: bold; color: #1F2937;">${weekAppts || 0}</p>
          <p style="margin: 4px 0 0; font-size: 11px; color: #6B7280;">CITAS</p>
          <p style="margin: 2px 0 0; font-size: 11px; color: #6B7280;">${attendanceRate}% asistencia</p>
        </td>
        <td style="width: 8px;"></td>
        <td style="padding: 12px; text-align: center; background: #F5F7FA; border-radius: 8px;">
          <p style="margin: 0; font-size: 24px; font-weight: bold; color: #1F2937;">${newClients || 0}</p>
          <p style="margin: 4px 0 0; font-size: 11px; color: #6B7280;">NUEVOS CLIENTES</p>
        </td>
      </tr>
    </table>

    <!-- Details -->
    <div style="margin: 20px 0; padding: 16px; background: #F5F7FA; border-radius: 12px;">
      <p style="margin: 0 0 8px; font-size: 13px; font-weight: bold; color: #1F2937;">Detalles:</p>
      <p style="margin: 4px 0; font-size: 12px; color: #6B7280;">• Transacciones: ${weekTxCount}</p>
      <p style="margin: 4px 0; font-size: 12px; color: #6B7280;">• Completadas: ${completedAppts || 0} | No-shows: ${noShows || 0} | Canceladas: ${cancellations || 0}</p>
      <p style="margin: 4px 0; font-size: 12px; color: #6B7280;">• Top servicios: ${topServices.join(", ") || "—"}</p>
      <p style="margin: 4px 0; font-size: 12px; color: #6B7280;">• Top profesionales: ${topBarbers.map((b) => `${b.name} (${formatCLP(b.total)})`).join(", ") || "—"}</p>
    </div>

    <!-- AI Insights -->
    <div style="margin: 20px 0; padding: 16px; background: #0F8B8D10; border: 1px solid #0F8B8D30; border-radius: 12px;">
      <p style="margin: 0 0 8px; font-size: 13px; font-weight: bold; color: #0F8B8D;">🦦 Otti dice:</p>
      <p style="margin: 0; font-size: 13px; color: #1F2937; line-height: 1.6; white-space: pre-line;">${aiInsights}</p>
    </div>

    <div style="text-align: center; margin-top: 24px;">
      <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://barberia-kappa-weld.vercel.app"}/dashboard/reportes" style="display: inline-block; background: #0F8B8D; color: white; text-decoration: none; padding: 10px 24px; border-radius: 8px; font-weight: bold; font-size: 13px;">
        Ver reporte completo
      </a>
    </div>

    <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e7eb; text-align: center;">
      <p style="color: #6B7280; font-size: 11px; margin: 0;">re-booking · Todo tu negocio. Un solo sistema.</p>
    </div>
  </div>
</body>
</html>`;

      for (const email of recipients) {
        await resend.emails.send({
          from: process.env.EMAIL_FROM || "re-booking <no-reply@re-booking.cl>",
          to: email,
          subject: `📊 Informe semanal re-booking — ${formatCLP(weekIncome)} esta semana`,
          html,
        });
      }
    } catch (e) {
      console.error("Error sending weekly report:", e);
    }
  }

  return NextResponse.json({
    sent: recipients.length,
    weekIncome,
    incomeChange,
    weekAppts,
    newClients,
    aiInsights: aiInsights.slice(0, 100) + "...",
  });
}
