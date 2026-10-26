import { getResendClient } from "@/lib/resend-client";
import type { DailyAppointmentReport } from "./informe-diario";

const escapeHtml = (value: unknown): string =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const STATUS_LABELS: Record<string, string> = {
  scheduled: "Agendada",
  confirmed: "Confirmada",
  in_progress: "En atención",
  completed: "Completada",
  cancelled: "Cancelada",
  no_show: "No asistió",
};

export function dailyReportSubject(report: DailyAppointmentReport): string {
  return `Informe diario de citas · ${report.businessName} · ${report.date}`;
}

export function renderDailyReportEmail(report: DailyAppointmentReport): string {
  const professionalSections = report.professionals.length === 0
    ? `<p style="margin:20px 0;color:#4b5563;">No hay citas registradas para este día.</p>`
    : report.professionals.map((professional) => `
      <h2 style="margin:24px 0 8px;font-size:17px;color:#111827;">${escapeHtml(professional.name)}</h2>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
        <thead><tr>
          <th align="left" style="padding:8px;border-bottom:2px solid #d1d5db;font-size:12px;color:#4b5563;">Hora</th>
          <th align="left" style="padding:8px;border-bottom:2px solid #d1d5db;font-size:12px;color:#4b5563;">Servicio</th>
          <th align="left" style="padding:8px;border-bottom:2px solid #d1d5db;font-size:12px;color:#4b5563;">Cliente</th>
          <th align="left" style="padding:8px;border-bottom:2px solid #d1d5db;font-size:12px;color:#4b5563;">Estado</th>
        </tr></thead>
        <tbody>${professional.appointments.map((appointment) => `<tr>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${escapeHtml(appointment.time)}</td>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${escapeHtml(appointment.service)}</td>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${escapeHtml(appointment.client)}</td>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${escapeHtml(STATUS_LABELS[appointment.status] || appointment.status)}</td>
        </tr>`).join("")}</tbody>
      </table>`).join("");

  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;background:#f3f4f6;font-family:Arial,sans-serif;color:#111827;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px;">
    <table role="presentation" width="640" cellpadding="0" cellspacing="0" style="width:100%;max-width:640px;background:#fff;border:1px solid #e5e7eb;border-radius:12px;">
      <tr><td style="padding:28px;">
        <div style="font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:#0f766e;">Informe diario</div>
        <h1 style="margin:8px 0 4px;font-size:24px;">${escapeHtml(report.businessName)}</h1>
        <p style="margin:0 0 20px;color:#6b7280;">Citas del ${escapeHtml(report.date)}</p>
        <table role="presentation" cellpadding="0" cellspacing="0"><tr>
          <td style="padding:10px 16px;background:#f0fdfa;border-radius:8px;"><strong>${report.totalAppointments}</strong><br><span style="font-size:12px;color:#4b5563;">Citas totales</span></td>
          <td width="12"></td>
          <td style="padding:10px 16px;background:#fffbeb;border-radius:8px;"><strong>${report.pendingAppointments}</strong><br><span style="font-size:12px;color:#4b5563;">Pendientes</span></td>
        </tr></table>
        <p style="margin:12px 0;color:#6b7280;font-size:12px;">Canceladas: ${report.cancelledAppointments} · No asistió: ${report.noShowAppointments}</p>
        ${professionalSections}
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;
}

export async function sendDailyReportEmail(args: {
  report: DailyAppointmentReport;
  recipients: string[];
}) {
  if (args.recipients.length === 0) throw new Error("No hay correos destinatarios configurados");
  const resend = getResendClient();
  const { data, error } = await resend.emails.send({
    // Mismo fallback que resend.ts (recibos y avisos internos); dominios pendientes de Nico en la pregunta 19.
    from: process.env.EMAIL_FROM || "re-booking <no-reply@re-booking.cl>",
    to: args.recipients,
    subject: dailyReportSubject(args.report),
    html: renderDailyReportEmail(args.report),
  });
  if (error) throw new Error(`Error enviando informe diario: ${error.message}`);
  return data;
}
