import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, getCurrentUserRoleAndTenant, isManagerLevel, resolveTenantForRequest } from "@/lib/supabase/server";
import { todayInChile } from "@/lib/utils";
import { createDailyAppointmentReport, getDailyReportSettings, isValidReportDate } from "@/lib/agente/informe-diario";
import { sendDailyReportEmail } from "@/lib/agente/informe-diario-email";

export async function POST(req: NextRequest) {
  const caller = await getCurrentUserRoleAndTenant();
  if (!caller.userId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const manager = await isManagerLevel();
  if (!manager.ok) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  let body: { tenantId?: string; date?: string } = {};
  try {
    body = await req.json();
  } catch {}

  const resolved = await resolveTenantForRequest(body.tenantId || null);
  if (resolved.denied || !resolved.tenantId || resolved.tenantId === "ALL") {
    return NextResponse.json({ error: "Selecciona un negocio autorizado" }, { status: 403 });
  }

  const date = body.date || todayInChile();
  if (!isValidReportDate(date)) {
    return NextResponse.json({ error: "Fecha inválida; usa YYYY-MM-DD" }, { status: 400 });
  }

  const supabase = createAdminSupabase();
  try {
    const settings = await getDailyReportSettings(supabase, resolved.tenantId);
    if (settings.status === "missing_migration") {
      return NextResponse.json({ error: "Falta aplicar la migración del informe diario" }, { status: 503 });
    }
    if (settings.status === "disabled") {
      return NextResponse.json({ error: "El informe diario está apagado para este negocio" }, { status: 409 });
    }
    if (settings.recipients.length === 0) {
      return NextResponse.json({ error: "No hay correos destinatarios configurados" }, { status: 409 });
    }

    const { data: tenant, error: tenantError } = await supabase
      .from("tenants")
      .select("name")
      .eq("id", resolved.tenantId)
      .maybeSingle();
    if (tenantError) throw new Error(tenantError.message);
    if (!tenant) return NextResponse.json({ error: "Negocio no encontrado" }, { status: 404 });

    const report = await createDailyAppointmentReport(supabase, {
      tenantId: resolved.tenantId,
      businessName: tenant.name || "Negocio",
      date,
    });
    await sendDailyReportEmail({ report, recipients: settings.recipients });

    return NextResponse.json({
      sent: true,
      date,
      totalAppointments: report.totalAppointments,
      pendingAppointments: report.pendingAppointments,
      recipients: settings.recipients.length,
    });
  } catch (error) {
    console.error("[agente/informe-diario]", error);
    return NextResponse.json({ error: "No se pudo generar o enviar el informe diario" }, { status: 500 });
  }
}
