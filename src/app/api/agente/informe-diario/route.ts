import { createAdminSupabase, getCurrentUserRoleAndTenant, isManagerLevel, resolveTenantForRequest } from "@/lib/supabase/server";
import { todayInChile } from "@/lib/utils";
import { createDailyAppointmentReport, getDailyReportSettings } from "@/lib/agente/informe-diario";
import { sendDailyReportEmail } from "@/lib/agente/informe-diario-email";
import { crearManejadorInformeManual } from "@/lib/agente/informe-diario-manual";

export const POST = crearManejadorInformeManual({
  usuario: getCurrentUserRoleAndTenant, gestor: isManagerLevel,
  negocio: resolveTenantForRequest, hoy: todayInChile, base: createAdminSupabase,
  configuracion: getDailyReportSettings, informe: createDailyAppointmentReport,
  enviar: sendDailyReportEmail,
});
