import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";
import { contextoChats } from "@/lib/agente/chats-acceso";
import { redisparar, PROPOSITO_RECORDATORIO_CITA } from "@/lib/agente/redisparar";
import { crearRepositorioRecordatorios } from "@/lib/agente/recordatorios-whatsapp";
import { enviarPlantilla, hashContactoWhatsApp } from "@/lib/agente/whatsapp-meta";
import { variablesPlantillaConfirmacion, textoPlantillaConfirmacion, PLANTILLA_CONFIRMACION_BOTONES, PLANTILLA_CITA_AVISO, IDIOMA_PLANTILLAS_CONFIRMACION, BOTONES_CONFIRMACION } from "@/lib/agente/plantilla-recordatorio";
import { registrarChat } from "@/lib/agente/chats";
import { tryConsumirCreditos } from "@/lib/wa-credits";
import { tryConsumeQuota } from "@/lib/message-quota";

// «Re-disparar»: reenvía la confirmación de una cita pendiente de respuesta. Solo administración, del negocio de la sesión.
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const c = await contextoChats(req); if ("error" in c) return c.error;
  const body = await req.json().catch(() => null);
  const citaId = typeof body?.cita === "string" ? body.cita : "";
  if (!/^[0-9a-f-]{36}$/i.test(citaId)) return NextResponse.json({ error: "Cita no válida" }, { status: 400 });
  const tenantId = c.tenantId, db = createAdminSupabase(), sal = process.env.AGENTE_CONTACT_HASH_SALT ?? "";
  const aj = await db.from("agent_whatsapp_settings").select("phone_number_id,enabled").eq("tenant_id", tenantId).maybeSingle();
  if (aj.error || aj.data?.enabled !== true || !aj.data.phone_number_id || !sal) return NextResponse.json({ error: "El negocio no tiene WhatsApp activo" }, { status: 409 });
  const repo = crearRepositorioRecordatorios(db, { sinMarca: true });
  const entregas = () => db.from("agent_reminder_deliveries");
  try {
    const r = await redisparar(citaId, tenantId, {
      ahora: Date.now, sal,
      cita: (id) => repo.actual({ id, tenant_id: tenantId } as any),
      entrega: async (id) => {
        const e = await entregas().select("id,provider_accepted_at").eq("tenant_id", tenantId).eq("appointment_id", id).eq("channel", "whatsapp").eq("purpose", PROPOSITO_RECORDATORIO_CITA).eq("status", "aceptado_proveedor").maybeSingle();
        if (e.error) throw new Error("entregas");
        return e.data as any;
      },
      baja: (hash) => repo.baja(tenantId, hash),
      reclamar: async (e, iso) => {
        let q = entregas().update({ provider_accepted_at: iso }).eq("tenant_id", tenantId).eq("id", e.id);
        q = e.provider_accepted_at ? q.eq("provider_accepted_at", e.provider_accepted_at) : q.is("provider_accepted_at", null);
        const u = await q.select("id").maybeSingle();
        if (u.error) throw new Error("entregas");
        return !!u.data;
      },
      devolver: async (e) => { await entregas().update({ provider_accepted_at: e.provider_accepted_at }).eq("tenant_id", tenantId).eq("id", e.id); },
      consumirCuota: async () => {
        const cr = await tryConsumirCreditos(tenantId, "utility", `redisparo-${citaId}-${Date.now()}`, db);
        return cr !== null ? cr : tryConsumeQuota(tenantId, "whatsapp", "reminder");
      },
      enviar: async (cita, para, conBotones) => {
        const t = await db.from("tenants").select("name").eq("id", tenantId).maybeSingle();
        const variables = variablesPlantillaConfirmacion(cita, t.data?.name ? String(t.data.name) : "");
        const res = await enviarPlantilla({ para, plantilla: conBotones ? PLANTILLA_CONFIRMACION_BOTONES : PLANTILLA_CITA_AVISO, idioma: IDIOMA_PLANTILLAS_CONFIRMACION, variables, ...(conBotones ? { botones: BOTONES_CONFIRMACION } : {}) }, {
          token: process.env.WHATSAPP_ACCESS_TOKEN ?? "", version: process.env.WHATSAPP_API_VERSION ?? "", phone_number_id: String(aj.data!.phone_number_id),
          fetch: (u, o) => fetch(u, { ...o, signal: AbortSignal.timeout(5000) }),
        });
        if (res.estado === "aceptado") await registrarChat(db, { tenantId, contactHash: hashContactoWhatsApp(sal, tenantId, para), telefono: para, direccion: "saliente", tipo: "plantilla", texto: textoPlantillaConfirmacion(conBotones, variables) });
        return res;
      },
      anotar: async (e, proveedor) => { await entregas().update({ provider_message_id: proveedor }).eq("tenant_id", tenantId).eq("id", e.id); },
    });
    return r.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: r.error }, { status: r.status });
  } catch { return NextResponse.json({ error: "No se pudo reenviar" }, { status: 500 }); }
}
