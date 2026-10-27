import { crearManejadorRecordatorios, crearRepositorioRecordatorios } from "@/lib/agente/recordatorios-whatsapp";
import { crearAutorizadorInformeProgramado } from "@/lib/agente/informe-programado";
import { enviarPlantilla, verificarConfiguracionWhatsApp } from "@/lib/agente/whatsapp-meta";
import { createAdminSupabase } from "@/lib/supabase/server";
import { getQuotaStatus, tryConsumeQuota } from "@/lib/message-quota";
import { sendAppointmentReminder } from "@/lib/resend";
import { parseWallClock } from "@/lib/wallclock";

export const dynamic = "force-dynamic";
export const GET = crearManejadorRecordatorios({
  configuracion: () => verificarConfiguracionWhatsApp(process.env),
  autorizar: crearAutorizadorInformeProgramado(), // Reutiliza verifyCron, también para dryRun.
  // BLOQUEO TÉCNICO: el cron antiguo no respeta reclamos en curso. No basta reminder_sent:
  // puede haber leído ya su snapshot. Claude debe coordinar ambos antes de habilitar esta ruta.
  permitirEnvio: false,
  crearDependencias: () => {
    const db = createAdminSupabase();
    return {
      repo: crearRepositorioRecordatorios(db), ahora: Date.now,
      sal: process.env.AGENTE_CONTACT_HASH_SALT ?? "",
      tieneCuota: async (tenant, canal) => {
        const status = await getQuotaStatus(tenant, canal);
        return !!status && (status.remaining === null || status.remaining > 0);
      },
      consumirCuota: (tenant, canal, citaId) => tryConsumeQuota(tenant, canal, "reminder", citaId),
      enviarWhatsApp: (negocio, cita, para) => enviarPlantilla({
        para, plantilla: process.env.WHATSAPP_REMINDER_TEMPLATE ?? "",
        idioma: process.env.WHATSAPP_REMINDER_LANGUAGE ?? "",
        // INFERENCIA: orden propuesto; validar contra la plantilla aprobada antes de habilitar.
        variables: [cita.date, cita.start_time.slice(11,16), cita.barber?.name ?? "Tu profesional",
          cita.services.map(s => s.service?.name).filter(Boolean).join(", ") || "Servicio"],
      }, {
        token: process.env.WHATSAPP_ACCESS_TOKEN ?? "", version: process.env.WHATSAPP_API_VERSION ?? "",
        phone_number_id: negocio.phoneNumberId,
        fetch: (url, options) => fetch(url, { ...options, signal: AbortSignal.timeout(5000) }),
      }),
      enviarCorreo: async cita => {
        if (!cita.client?.email) return { estado: "fallido" };
        await sendAppointmentReminder({
          to: cita.client.email, clientName: cita.client.name,
          barberName: cita.barber?.name ?? "Tu profesional",
          serviceName: cita.services.map(s => s.service?.name).filter(Boolean).join(", ") || "Servicio",
          date: parseWallClock(cita.start_time), appointmentId: cita.id,
        });
        // HECHO: resend.ts:457-465 descarta la respuesta del proveedor y devuelve void.
        // No inventar aceptación: no reintentar; Claude debe exponer el resultado verificado.
        return { estado: "incierto" };
      },
    };
  },
});
