import { crearRepositorioDatosNegocio } from "@/lib/agente/datos-negocio";
// Se reutiliza la MISMA función que calcula las horas de la reserva web (en el servidor, solo lectura): una sola regla.
import { GET as disponibilidadPublica } from "@/app/api/public/availability/route";
import { crearManejadoresWebhook, crearRepositorioWebhook, accionesDesdeBase } from "@/lib/agente/whatsapp-webhook";
import { enviarTexto } from "@/lib/agente/whatsapp-meta";
import { POST as reservaPublica } from "@/app/api/public/book/route";
import { ahoraChile } from "@/lib/agente/disponibilidad";
import { formatPhoneCL } from "@/lib/phone";
import { responderConIA, TOPE_IA_POR_DEFECTO, MODELO_IA } from "@/lib/agente/ia-respuesta";
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
      // Modo Avanzado (IA): solo si el negocio lo activó, hay llave y no se pasó del tope del mes. Falla cerrado: ante cualquier duda, null.
      ia: async (tenantId, texto, datosNegocio) => {
        const llave = process.env.ANTHROPIC_API_KEY;
        if (!llave) return null;
        const c = await db.from("agent_ai_context").select("contexto,ia_activa,limite_mensual").eq("tenant_id", tenantId).maybeSingle();
        if (c.error || !c.data || c.data.ia_activa !== true || typeof c.data.contexto !== "string") return null;
        const mes = ahoraChile(Date.now()).fecha.slice(0, 7);
        const [anio, nmes] = mes.split("-").map(Number);
        const mesSiguiente = nmes === 12 ? `${anio + 1}-01-01` : `${anio}-${String(nmes + 1).padStart(2, "0")}-01`; // "-31" no existe en meses de 30 días y la consulta falla
        const usados = await db.from("agent_whatsapp_indicadores").select("total").eq("tenant_id", tenantId).eq("campo", "respuestas_ia").gte("dia", `${mes}-01`).lt("dia", mesSiguiente);
        if (usados.error) return null;
        const total = (usados.data ?? []).reduce((a: number, r: any) => a + Number(r.total || 0), 0);
        if (total >= (typeof c.data.limite_mensual === "number" ? c.data.limite_mensual : TOPE_IA_POR_DEFECTO)) return null;
        const r = await responderConIA(texto, { contexto: c.data.contexto, nombreNegocio: datosNegocio?.negocio.nombre ?? null }, {
          llamar: async ({ modelo, sistema, usuario, maxTokens }) => {
            const res = await fetch("https://api.anthropic.com/v1/messages", {
              method: "POST", headers: { "x-api-key": llave, "anthropic-version": "2023-06-01", "content-type": "application/json" },
              body: JSON.stringify({ model: modelo || MODELO_IA, max_tokens: maxTokens, thinking: { type: "disabled" }, system: sistema, messages: [{ role: "user", content: usuario }] }),
              signal: AbortSignal.timeout(8000),
            });
            if (!res.ok) return null;
            const j: any = await res.json().catch(() => null);
            const t = j?.content?.find?.((b: any) => b?.type === "text")?.text;
            return typeof t === "string" ? t : null;
          },
        });
        if (r !== null) await db.rpc("agent_whatsapp_contar", { p_tenant: tenantId, p_dia: ahoraChile(Date.now()).fecha, p_campo: "respuestas_ia" });
        return r;
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
