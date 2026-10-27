import { NextRequest, NextResponse } from "next/server";
import { isValidReportDate } from "./informe-diario";
import type { createDailyAppointmentReport, getDailyReportSettings } from "./informe-diario";
import type { sendDailyReportEmail } from "./informe-diario-email";

export interface DependenciasInformeManual {
  usuario: () => Promise<{ userId: string | null }>;
  gestor: () => Promise<{ ok: boolean }>;
  negocio: (id: string | null) => Promise<{ tenantId: string | null; denied: boolean }>;
  hoy: () => string;
  base: () => any;
  configuracion: typeof getDailyReportSettings;
  informe: typeof createDailyAppointmentReport;
  enviar: typeof sendDailyReportEmail;
}

// Flujo existente de la ruta manual, extraído sin cambiar permisos ni consultas.
export function crearManejadorInformeManual(deps: DependenciasInformeManual) {
  return async (req: NextRequest) => {
    const caller = await deps.usuario();
    if (!caller.userId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const manager = await deps.gestor();
    if (!manager.ok) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

    let body: { tenantId?: string; date?: string } = {};
    try {
      body = await req.json();
    } catch {}

    const resolved = await deps.negocio(body.tenantId || null);
    if (resolved.denied || !resolved.tenantId || resolved.tenantId === "ALL") {
      return NextResponse.json({ error: "Selecciona un negocio autorizado" }, { status: 403 });
    }

    const date = body.date || deps.hoy();
    if (!isValidReportDate(date)) {
      return NextResponse.json({ error: "Fecha inválida; usa YYYY-MM-DD" }, { status: 400 });
    }

    const supabase = deps.base();
    try {
      const settings = await deps.configuracion(supabase, resolved.tenantId);
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

      const report = await deps.informe(supabase, {
        tenantId: resolved.tenantId,
        businessName: tenant.name || "Negocio",
        date,
      });
      await deps.enviar({ report, recipients: settings.recipients });

      return NextResponse.json({
        sent: true,
        date,
        totalAppointments: report.totalAppointments,
        pendingAppointments: report.pendingAppointments,
        cancelledAppointments: report.cancelledAppointments,
        noShowAppointments: report.noShowAppointments,
        recipients: settings.recipients.length,
      });
    } catch (error) {
      console.error("[agente/informe-diario]", error);
      return NextResponse.json({ error: "No se pudo generar o enviar el informe diario" }, { status: 500 });
    }
  };
}
