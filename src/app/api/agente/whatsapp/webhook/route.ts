import { crearManejadoresWebhook, crearRepositorioWebhook, accionesDesdeBase } from "@/lib/agente/whatsapp-webhook";
import { enviarTexto } from "@/lib/agente/whatsapp-meta";
import { createAdminSupabase } from "@/lib/supabase/server";
import { getResendClient } from "@/lib/resend-client";
import { resolverRemitente } from "@/lib/agente/informe-diario-email";

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
      responder: (negocio, para, texto) => enviarTexto({ para, texto }, {
        token: process.env.WHATSAPP_ACCESS_TOKEN ?? "", version: process.env.WHATSAPP_API_VERSION ?? "",
        phone_number_id: negocio.phoneNumberId,
        fetch: (url, options) => fetch(url, { ...options, signal: AbortSignal.timeout(5000) }),
      }),
      avisarAdministrador: async tenantId => {
        // Paginación estable como fetchAllRows; ningún dato del mensaje entra al correo.
        for (let from = 0; ; from += 1000) {
          const r = await db.from("profiles").select("id,email").eq("tenant_id", tenantId)
            .eq("role", "admin").eq("active", true).order("id").range(from, from + 999);
          if (r.error) throw new Error("Aviso al administrador no disponible");
          for (const p of r.data ?? []) {
            if (typeof p.email !== "string" || !/^[^\s@<>;,]+@[^\s@<>;,]+\.[^\s@<>;,]+$/.test(p.email)) continue;
            const result = await getResendClient().emails.send({
              from: resolverRemitente(process.env.EMAIL_FROM), to: p.email,
              subject: "WhatsApp: una consulta necesita atención",
              html: "<p>Un cliente necesita atención por WhatsApp. Revisa el canal del negocio para responderle.</p>",
            });
            if (result.error) throw new Error("Aviso al administrador no aceptado");
          }
          if (!r.data || r.data.length < 1000) break;
        }
      },
    };
  },
});
export const GET = (req: Request) => handlers().GET(req);
export const POST = (req: Request) => handlers().POST(req);
