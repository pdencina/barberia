import { crearRepositorioDatosNegocio } from "@/lib/agente/datos-negocio";
// Se reutiliza la MISMA función que calcula las horas de la reserva web (en el servidor, solo lectura): una sola regla.
import { GET as disponibilidadPublica } from "@/app/api/public/availability/route";
import { crearManejadoresWebhook, crearRepositorioWebhook, accionesDesdeBase } from "@/lib/agente/whatsapp-webhook";
import { enviarTexto } from "@/lib/agente/whatsapp-meta";
import { POST as reservaPublica } from "@/app/api/public/book/route";
import { ahoraChile } from "@/lib/agente/disponibilidad";
import { formatPhoneCL } from "@/lib/phone";
import { createAdminSupabase } from "@/lib/supabase/server";
import { getResendClient } from "@/lib/resend-client";
import { resolverRemitente } from "@/lib/agente/informe-diario-email";

import { fetchAllRows } from "@/lib/accounting";

export const dynamic = "force-dynamic";
const handlers = () => crearManejadoresWebhook({
  secretoFirma: process.env.WHATSAPP_APP_SECRET,
  tokenVerificacion: process.env.WHATSAPP_VERIFY_TOKEN,
  salHashes: process.env.AGENTE_CONTACT_HASH_SALT,
  crearDependencias: () => {
    const db = createAdminSupabase();
    return {
      repo: crearRepositorioWebhook(db, process.env.AGENTE_CONTACT_HASH_SALT!), ahora: Date.now,
      accion: accionesDesdeBase(db),
      datosDelNegocio: crearRepositorioDatosNegocio(db).datosDelNegocio,
      horasLibres: async (profesionalId, fecha, duracionMin) => {
        const res = await disponibilidadPublica(new Request(`https://interno.invalid/api/public/availability?barberId=${encodeURIComponent(profesionalId)}&date=${fecha}&duration=${duracionMin}`) as any);
        if (!res.ok) throw new Error("Disponibilidad no disponible");
        const j: any = await res.json();
        return { slots: Array.isArray(j.slots) ? j.slots : [], cerrado: !!(j.closed || j.vacation || j.blocked), fueraDeVentana: !!j.outOfWindow };
      },
      // Reserva por chat: memoria mínima (sin texto, nombre ni correo) y la misma reserva que la web.
      chat: {
        leerEstado: async (tenantId, contactHash, ahora) => {
          const r = await db.from("agent_chat_state").select("etapa,datos,expires_at").eq("tenant_id", tenantId).eq("contact_hash", contactHash).maybeSingle();
          if (r.error || !r.data || new Date(r.data.expires_at).getTime() <= ahora) return null;
          return { etapa: r.data.etapa, datos: r.data.datos } as any;
        },
        guardarEstado: async (tenantId, contactHash, estado, expiraMs) => {
          const r = await db.from("agent_chat_state").upsert({ tenant_id: tenantId, contact_hash: contactHash, etapa: estado.etapa, datos: estado.datos, expires_at: new Date(expiraMs).toISOString(), updated_at: new Date().toISOString() }, { onConflict: "tenant_id,contact_hash" });
          if (r.error) throw new Error("Memoria no disponible");
        },
        borrarEstado: async (tenantId, contactHash) => { await db.from("agent_chat_state").delete().eq("tenant_id", tenantId).eq("contact_hash", contactHash); },
        reservasFuturas: async (tenantId, telefono, ahora) => {
          const largo = formatPhoneCL(telefono), corto = largo.replace(/^\+56/, "");
          const cl = await db.from("clients").select("id").eq("tenant_id", tenantId).in("phone", Array.from(new Set([largo, largo.replace("+", ""), corto, telefono]))).limit(20);
          const ids = (cl.data ?? []).map((c: any) => c.id);
          if (ids.length === 0) return 0;
          const ap = await db.from("appointments").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).in("client_id", ids).in("status", ["scheduled", "confirmed"]).gte("date", ahoraChile(ahora).fecha);
          if (ap.error) throw new Error("Reservas no disponibles");
          return ap.count ?? 0;
        },
        crearReserva: async (tenantId, a) => {
          const res = await reservaPublica(new Request("https://interno.invalid/api/public/book", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
            serviceIds: [a.servicioId], barberId: a.profesionalId, date: a.fecha, startTime: `${a.fecha}T${a.hora}:00`, clientName: a.nombre, clientEmail: a.correo, clientPhone: formatPhoneCL(a.telefono) }) }) as any);
          const j: any = await res.json().catch(() => ({}));
          if (res.ok && j.success && j.appointmentId) {
            // Origen para los indicadores de fin de mes (solo esta cita, del mismo negocio).
            await db.from("appointments").update({ source: "whatsapp_agente" }).eq("id", j.appointmentId).eq("tenant_id", tenantId);
            return { ok: true, citaId: j.appointmentId };
          }
          if (res.status === 409) return { ok: false, motivo: "ocupada" };
          if (res.status === 403) return { ok: false, motivo: "suspendido" };
          return { ok: false, motivo: "otro" };
        },
        contar: async (tenantId, campo, ahora) => { await db.rpc("agent_whatsapp_contar", { p_tenant: tenantId, p_dia: ahoraChile(ahora).fecha, p_campo: campo }); },
      },
      // Falla cerrado: si no se puede leer el estado, lanza y el evento queda "fallido" sin responder.
      negocioInactivo: async tenantId => {
        const r = await db.from("tenants").select("active,status").eq("id", tenantId).maybeSingle();
        if (r.error || !r.data) throw new Error("Estado del negocio no disponible");
        return r.data.active !== true || r.data.status === "suspended";
      },
      responder: (negocio, para, texto) => enviarTexto({ para, texto }, {
        token: process.env.WHATSAPP_ACCESS_TOKEN ?? "", version: process.env.WHATSAPP_API_VERSION ?? "",
        phone_number_id: negocio.phoneNumberId,
        fetch: (url, options) => fetch(url, { ...options, signal: AbortSignal.timeout(5000) }),
      }),
      avisarAdministrador: async tenantId => {
        const profiles = await fetchAllRows<{id: string; email: string}>(() =>
          db.from("profiles").select("id,email").eq("tenant_id", tenantId).eq("role", "admin").eq("active", true));
        for (const p of profiles) {
          if (typeof p.email !== "string" || !/^[^\s@<>;,]+@[^\s@<>;,]+\.[^\s@<>;,]+$/.test(p.email)) continue;
          const result = await getResendClient().emails.send({
            from: resolverRemitente(process.env.EMAIL_FROM), to: p.email,
            subject: "WhatsApp: una consulta necesita atención",
            html: "<p>Un cliente necesita atención por WhatsApp. Revisa el canal del negocio para responderle.</p>",
          });
          if (result.error) throw new Error("Aviso al administrador no aceptado");
        }
      },
    };
  },
});
export const GET = (req: Request) => handlers().GET(req);
export const POST = (req: Request) => handlers().POST(req);
