import { registrarChat, purgarChats } from "@/lib/agente/chats";
import { hashContactoWhatsApp } from "@/lib/agente/whatsapp-meta";
import { procesarAvisos, repoAvisoDesdeBase } from "@/lib/agente/aviso-cancelacion";
import { notify } from "@/lib/notify";
import { horaAmPm } from "@/lib/hora-ampm";
import { PLANTILLA_ULTIMO_AVISO, textoPlantillaUltimoAviso, textoPlantillaConfirmacion, variablesPlantillaConfirmacion, PLANTILLA_CONFIRMACION_BOTONES, PLANTILLA_CITA_AVISO, IDIOMA_PLANTILLAS_CONFIRMACION, BOTONES_CONFIRMACION } from "@/lib/agente/plantilla-recordatorio";
import { getClientColorTheme } from "@/lib/client-theme";
import { crearManejadorRecordatorios, crearRepositorioRecordatorios } from "@/lib/agente/recordatorios-whatsapp";
import { crearAutorizadorInformeProgramado } from "@/lib/agente/informe-programado";
import { enviarPlantilla, verificarConfiguracionWhatsApp } from "@/lib/agente/whatsapp-meta";
import { createAdminSupabase } from "@/lib/supabase/server";
import { getQuotaStatus, tryConsumeQuota } from "@/lib/message-quota";
import { hayCreditos, tryConsumirCreditos } from "@/lib/wa-credits";
import { sendAppointmentReminder } from "@/lib/resend";
import { telefonoDeCita } from "@/lib/contacto-negocio";
import { parseWallClock } from "@/lib/wallclock";

// Confirmación de citas por WhatsApp (cada 5 minutos, ver vercel.json). Solo negocios con agent_whatsapp_settings.confirmacion_activa = true.
// Desde 8 h antes de la cita (o de inmediato si agenda con menos): con más de 3 h por delante lleva 3 botones (confirmar, cancelar, modificar);
// con menos de 3 h solo avisa. Las respuestas las procesa el webhook del agente.
export const dynamic = "force-dynamic";
const confirmaciones = crearManejadorRecordatorios({
  modo: "confirmacion",
  permitirEnvio: true,
  configuracion: () => verificarConfiguracionWhatsApp(process.env),
  autorizar: crearAutorizadorInformeProgramado(),
  crearDependencias: () => {
    const db = createAdminSupabase();
    const nombres = new Map<string, string>();
    const nombreNegocio = async (tenantId: string) => {
      if (nombres.has(tenantId)) return nombres.get(tenantId)!;
      const r = await db.from("tenants").select("name").eq("id", tenantId).maybeSingle();
      const n = r.data?.name ? String(r.data.name) : "";
      nombres.set(tenantId, n); return n;
    };
    return {
      repo: crearRepositorioRecordatorios(db, { sinMarca: true }), ahora: Date.now,
      sal: process.env.AGENTE_CONTACT_HASH_SALT ?? "",
      tieneCuota: async (tenant, canal) => {
        if (canal === "whatsapp") { const c = await hayCreditos(tenant, "utility", db); if (c !== null) return c; }
        const status = await getQuotaStatus(tenant, canal);
        return !!status && (status.remaining === null || status.remaining > 0);
      },
      consumirCuota: async (tenant, canal, citaId) => {
        if (canal === "whatsapp") { const c = await tryConsumirCreditos(tenant, "utility", citaId, db); if (c !== null) return c; }
        return tryConsumeQuota(tenant, canal, "reminder", citaId);
      },
      enviarWhatsApp: async (negocio, cita, para, opciones) => {
        const conBotones = opciones?.conBotones !== false;
        const variables = variablesPlantillaConfirmacion(cita, await nombreNegocio(cita.tenant_id));
        const r = await enviarPlantilla({
          para, plantilla: conBotones ? PLANTILLA_CONFIRMACION_BOTONES : PLANTILLA_CITA_AVISO,
          idioma: IDIOMA_PLANTILLAS_CONFIRMACION,
          variables,
          ...(conBotones ? { botones: BOTONES_CONFIRMACION } : {}),
        }, {
          token: process.env.WHATSAPP_ACCESS_TOKEN ?? "", version: process.env.WHATSAPP_API_VERSION ?? "",
          phone_number_id: negocio.phoneNumberId,
          fetch: (url, options) => fetch(url, { ...options, signal: AbortSignal.timeout(5000) }),
        });
        if (r.estado === "aceptado") {
          await registrarChat(db, { tenantId: cita.tenant_id, contactHash: hashContactoWhatsApp(process.env.AGENTE_CONTACT_HASH_SALT ?? "", cita.tenant_id, para), telefono: para, direccion: "saliente", tipo: "plantilla", texto: textoPlantillaConfirmacion(conBotones, variables) });
          if (Math.random() < 0.05) await purgarChats(db);
        }
        return r;
      },
      enviarCorreo: async cita => {
        if (!cita.client?.email) return { estado: "fallido" };
        await sendAppointmentReminder({
          colorTheme: await getClientColorTheme(createAdminSupabase(), (cita as any).tenant_id),
          to: cita.client.email, clientName: cita.client.name,
          barberName: cita.barber?.name ?? "Tu profesional",
          serviceName: cita.services.map(s => s.service?.name).filter(Boolean).join(", ") || "Servicio",
          date: parseWallClock(cita.start_time), appointmentId: cita.id,
          businessPhone: await telefonoDeCita(createAdminSupabase(), cita.id),
        });
        return { estado: "incierto" };
      },
    };
  },
});

// Después de las confirmaciones: aviso a quien no respondió y cancelación 1 hora más tarde (interruptor aparte, apagado por defecto).
async function avisos() {
  const db = createAdminSupabase();
  const sal = process.env.AGENTE_CONTACT_HASH_SALT ?? "";
  return procesarAvisos({
    repo: repoAvisoDesdeBase(db), ahora: Date.now, sal,
    consumirCuota: async (tenant, citaId) => {
      const c = await tryConsumirCreditos(tenant, "utility", `aviso-${citaId}`, db);
      // Sin referencia: la cita ya contó por su confirmación y este es un segundo envío.
      return c !== null ? c : tryConsumeQuota(tenant, "whatsapp", "reminder");
    },
    enviar: async (negocio, cita, para, limite) => {
      const t = await db.from("tenants").select("name").eq("id", cita.tenant_id).maybeSingle();
      const variables = [...variablesPlantillaConfirmacion(cita, t.data?.name ? String(t.data.name) : ""), horaAmPm(limite)];
      const r = await enviarPlantilla({ para, plantilla: PLANTILLA_ULTIMO_AVISO, idioma: IDIOMA_PLANTILLAS_CONFIRMACION, variables, botones: BOTONES_CONFIRMACION }, {
        token: process.env.WHATSAPP_ACCESS_TOKEN ?? "", version: process.env.WHATSAPP_API_VERSION ?? "", phone_number_id: negocio.phoneNumberId,
        fetch: (url, options) => fetch(url, { ...options, signal: AbortSignal.timeout(5000) }),
      });
      if (r.estado === "aceptado") await registrarChat(db, { tenantId: cita.tenant_id, contactHash: hashContactoWhatsApp(sal, cita.tenant_id, para), telefono: para, direccion: "saliente", tipo: "plantilla", texto: textoPlantillaUltimoAviso(variables) });
      return r;
    },
    notificar: notify,
  });
}

export async function GET(req: Request) {
  const respuesta = await confirmaciones(req);
  // El manejador de arriba ya validó la llamada del cron; en modo de prueba (dryRun) no se avisa ni se cancela.
  if (respuesta.status === 200 && new URL(req.url).searchParams.get("dryRun") !== "1") {
    try { console.info("[agente] avisos de confirmación", JSON.stringify(await avisos())); }
    catch (e) { console.error("[agente] avisos de confirmación:", e instanceof Error ? e.message : "error"); }
  }
  return respuesta;
}
