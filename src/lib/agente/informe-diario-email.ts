import { getResendClient } from "@/lib/resend-client";
import type { DailyAppointmentReport } from "./informe-diario";
import { obtenerFechaHoraInforme } from "./calendario-informe";

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

// Instante opcional para conservar los llamadores de render existentes sin reloj real.
// El envío siempre lo proporciona; no se etiqueta "hoy" a un informe histórico.
export function renderDailyReportEmail(report: DailyAppointmentReport, generadoEn?: number): string {
  const local = generadoEn === undefined ? null : obtenerFechaHoraInforme(generadoEn);
  const encabezado = local
    ? `${report.date === local.fecha ? "Citas de hoy" : `Citas del ${escapeHtml(report.date)}`}, generado a las ${local.hora}${report.date === local.fecha ? "" : ` del ${local.fecha}`} (hora de Santiago)`
    : `Citas del ${escapeHtml(report.date)}`;
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
        <p style="margin:0 0 20px;color:#6b7280;">${encabezado}</p>
        ${local ? '<p style="color:#6b7280;font-size:12px;">La información puede cambiar después de esta hora.</p>' : ""}
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

interface ArgumentosEnvioInforme {
  report: DailyAppointmentReport;
  recipients: string[];
  generadoEn?: number;
}
export type ResultadoEnvioInforme = { estado: "aceptado"; id: string | null } | { estado: "fallido" | "incierto" };
export interface DependenciasCorreoInforme {
  remitente: () => string | undefined;
  cliente: () => { emails: { send: (payload: any) => Promise<any> } };
  ahora: () => number;
}

// Mismo respaldo que src/lib/resend.ts:168, por decisión de Nico (27 oct. 2026).
export async function enviarInformeConResultado(
  args: ArgumentosEnvioInforme,
  deps: DependenciasCorreoInforme = { remitente: () => process.env.EMAIL_FROM, cliente: getResendClient, ahora: Date.now },
): Promise<ResultadoEnvioInforme> {
  let resend: ReturnType<DependenciasCorreoInforme["cliente"]>, payload: any;
  try {
    const from = deps.remitente()?.trim() || "re-booking <no-reply@re-booking.cl>";
    if (args.recipients.length === 0) return { estado: "fallido" };
    payload = { from, to: args.recipients, subject: dailyReportSubject(args.report), html: renderDailyReportEmail(args.report, args.generadoEn ?? deps.ahora()) };
    resend = deps.cliente();
  } catch { return { estado: "fallido" }; } // No se llamó al proveedor.
  try {
    const { data, error } = await resend.emails.send(payload);
    if (!error && data) return { estado: "aceptado", id: typeof data.id === "string" ? data.id : null };
    // HECHO: el SDK convierte errores de red en application_error.
    // Los errores 5xx o desconocidos no demuestran que no haya salido el correo.
    const rechazo = ["missing_required_field", "invalid_access", "invalid_parameter", "invalid_region", "rate_limit_exceeded", "missing_api_key", "invalid_api_Key", "invalid_from_address", "validation_error", "not_found", "method_not_allowed"];
    return { estado: rechazo.includes(error?.name) ? "fallido" : "incierto" };
  } catch { return { estado: "incierto" }; }
}

export async function sendDailyReportEmail(args: ArgumentosEnvioInforme, deps?: DependenciasCorreoInforme) {
  const result = await enviarInformeConResultado(args, deps);
  if (result.estado !== "aceptado") throw new Error("No se pudo confirmar el envío del informe");
  return { id: result.id };
}
