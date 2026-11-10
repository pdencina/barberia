import { NextResponse } from "next/server";
import { enviarPlantilla } from "@/lib/agente/whatsapp-meta";
import { verifyCron } from "@/lib/cron-auth";
import { runDueCampaigns, type CampaignRepo, type Recipient } from "@/lib/empresas/campanas";
import { isEmpresasEnabled } from "@/lib/empresas/flag";
import { createAdminSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Cada 15 minutos: procesa las campañas de WhatsApp que ya tocan. Sin EMPRESAS_WHATSAPP_SEND=1 todo queda "simulado".
export async function GET(req: Request) {
  const denied = verifyCron(req);
  if (denied) return denied;
  if (!isEmpresasEnabled()) return NextResponse.json({ skipped: "empresas apagado" });
  const db = createAdminSupabase();
  const check = <T,>(r: { data: T; error: any }) => { if (r.error) throw new Error(r.error.message); return r.data; };

  const repo: CampaignRepo = {
    async dueCampaigns(nowIso) {
      const rows = check(await db.from("company_campaigns").select("id, tenant_id, template_name, template_language, audience")
        .in("status", ["scheduled", "sending"]).lte("scheduled_at", nowIso).order("scheduled_at").limit(10)) as any[];
      return rows.map((r) => ({ id: r.id, tenantId: r.tenant_id, templateName: r.template_name, templateLanguage: r.template_language, audience: r.audience }));
    },
    async claim(id, nowIso) {
      const { data } = await db.from("company_campaigns").update({ status: "sending", started_at: nowIso }).eq("id", id).eq("status", "scheduled").select("id");
      if (data?.length) return true;
      const { data: c } = await db.from("company_campaigns").select("status").eq("id", id).maybeSingle();
      return c?.status === "sending";
    },
    async recipients(tenantId) {
      const out: Recipient[] = [];
      for (let from = 0; ; from += 1000) {
        const rows = check(await db.from("company_customers").select("id, phone, customer_type")
          .eq("tenant_id", tenantId).eq("active", true).eq("whatsapp_opt_in", true).order("id").range(from, from + 999)) as any[];
        out.push(...rows.map((r) => ({ id: r.id, phone: r.phone, customerType: r.customer_type })));
        if (rows.length < 1000) break;
      }
      return out;
    },
    async alreadyDone(id) {
      const ids = new Set<string>();
      for (let from = 0; ; from += 1000) {
        const rows = check(await db.from("company_campaign_sends").select("customer_id").eq("campaign_id", id).order("customer_id").range(from, from + 999)) as any[];
        rows.forEach((r) => ids.add(r.customer_id));
        if (rows.length < 1000) break;
      }
      return ids;
    },
    async reserve(c, customerId) {
      const { error } = await db.from("company_campaign_sends").insert({ campaign_id: c.id, tenant_id: c.tenantId, customer_id: customerId, status: "uncertain" });
      return !error;
    },
    async finish(campaignId, customerId, status, providerId) {
      await db.from("company_campaign_sends").update({ status, provider_id: providerId ?? null }).eq("campaign_id", campaignId).eq("customer_id", customerId);
    },
    async optedOut(tenantId, hash) {
      const { data } = await db.from("agent_contact_optouts").select("id").eq("tenant_id", tenantId).eq("contact_hash", hash).maybeSingle();
      return !!data;
    },
    async whatsappNumber(tenantId) {
      const { data } = await db.from("agent_whatsapp_settings").select("phone_number_id, enabled").eq("tenant_id", tenantId).maybeSingle();
      return data?.enabled ? data.phone_number_id : null;
    },
    async markDone(id, nowIso) {
      await db.from("company_campaigns").update({ status: "done", finished_at: nowIso }).eq("id", id).eq("status", "sending");
    },
  };

  try {
    const result = await runDueCampaigns({
      repo,
      now: Date.now,
      env: {
        EMPRESAS_WHATSAPP_SEND: process.env.EMPRESAS_WHATSAPP_SEND,
        AGENTE_CONTACT_HASH_SALT: process.env.AGENTE_CONTACT_HASH_SALT,
        WHATSAPP_ACCESS_TOKEN: process.env.WHATSAPP_ACCESS_TOKEN,
        WHATSAPP_API_VERSION: process.env.WHATSAPP_API_VERSION,
      },
      send: ({ para, plantilla, idioma, phoneNumberId }) => enviarPlantilla({ para, plantilla, idioma, variables: [] }, {
        fetch: (url, opciones) => fetch(url, opciones),
        token: process.env.WHATSAPP_ACCESS_TOKEN ?? "",
        version: process.env.WHATSAPP_API_VERSION ?? "",
        phone_number_id: phoneNumberId,
      }),
    });
    return NextResponse.json(result);
  } catch (e) {
    // Sin la migración 160 no hay campañas que procesar: se responde tranquilo para no llenar el registro de errores.
    if (e instanceof Error && /does not exist|schema cache/i.test(e.message)) return NextResponse.json({ skipped: "Falta aplicar la migración 160." });
    console.error("[empresas] campañas:", e instanceof Error ? e.message : "error");
    return NextResponse.json({ error: "No se pudieron procesar las campañas." }, { status: 500 });
  }
}
