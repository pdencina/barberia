import { crearAutorizadorInformeProgramado, crearManejadorInformeProgramado, crearRepositorioInformeProgramado } from "@/lib/agente/informe-programado";
import { createAdminSupabase } from "@/lib/supabase/server";
import { createDailyAppointmentReport } from "@/lib/agente/informe-diario";
import { enviarInformeConResultado } from "@/lib/agente/informe-diario-email";

export const dynamic = "force-dynamic";
// verifyCron compartido, disponible tras el merge de sincronización #126.
export const GET = crearManejadorInformeProgramado({
  autorizar: crearAutorizadorInformeProgramado(),
  crearDependencias: () => {
    const db = createAdminSupabase();
    return {
      repo: crearRepositorioInformeProgramado(db), ahora: Date.now,
      generar: (tenantId, businessName, date) => createDailyAppointmentReport(db, { tenantId, businessName, date }),
      enviar: (report, correo, generadoEn) => enviarInformeConResultado({ report, recipients: [correo], generadoEn }),
    };
  },
});
