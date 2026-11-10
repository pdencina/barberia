import { hashContactoWhatsApp, normalizarTelefonoWhatsApp, type ResultadoEnvioPlantilla } from "@/lib/agente/whatsapp-meta";

// Campañas programadas por WhatsApp (Etapa 4). El envío real está BLOQUEADO salvo que se cumplan TODAS:
// EMPRESAS_WHATSAPP_SEND=1 en el servidor, número de WhatsApp activo para esa empresa (agent_whatsapp_settings),
// token y sal configurados. Si falta algo, cada destinatario queda como "simulated" y no se llama a Meta.

export const MAX_SENDS_PER_RUN = 300;

export type CampaignAudience = "all" | "clients" | "distributors";
export type SendStatus = "simulated" | "sent" | "failed" | "uncertain" | "skipped_optout" | "skipped_no_phone";

export type Campaign = { id: string; tenantId: string; templateName: string; templateLanguage: string; audience: CampaignAudience };
export type Recipient = { id: string; phone: string | null; customerType: "client" | "distributor" };

export interface CampaignRepo {
  dueCampaigns: (nowIso: string) => Promise<Campaign[]>;
  claim: (campaignId: string, nowIso: string) => Promise<boolean>;          // scheduled -> sending (o ya sending)
  recipients: (tenantId: string) => Promise<Recipient[]>;                    // clientes activos con permiso de WhatsApp
  alreadyDone: (campaignId: string) => Promise<Set<string>>;
  reserve: (c: Campaign, customerId: string) => Promise<boolean>;            // inserta "uncertain"; false si ya existía
  finish: (campaignId: string, customerId: string, status: SendStatus, providerId?: string) => Promise<void>;
  optedOut: (tenantId: string, hash: string) => Promise<boolean>;
  whatsappNumber: (tenantId: string) => Promise<string | null>;              // phone_number_id si la empresa tiene WhatsApp activo
  markDone: (campaignId: string, nowIso: string) => Promise<void>;
}

export interface CampaignDeps {
  repo: CampaignRepo;
  now: () => number;
  env: { EMPRESAS_WHATSAPP_SEND?: string; AGENTE_CONTACT_HASH_SALT?: string; WHATSAPP_ACCESS_TOKEN?: string; WHATSAPP_API_VERSION?: string };
  send: (args: { para: string; plantilla: string; idioma: string; phoneNumberId: string }) => Promise<ResultadoEnvioPlantilla>;
}

export const matchesAudience = (r: Recipient, a: CampaignAudience) =>
  a === "all" || (a === "clients" && r.customerType === "client") || (a === "distributors" && r.customerType === "distributor");

export async function runDueCampaigns(deps: CampaignDeps) {
  const nowIso = new Date(deps.now()).toISOString();
  const out = { campaigns: 0, simulated: 0, sent: 0, failed: 0, uncertain: 0, skipped: 0, realSending: false };
  const sendingAllowed = deps.env.EMPRESAS_WHATSAPP_SEND === "1" && !!deps.env.WHATSAPP_ACCESS_TOKEN && !!deps.env.WHATSAPP_API_VERSION;
  const salt = deps.env.AGENTE_CONTACT_HASH_SALT || "";
  let budget = MAX_SENDS_PER_RUN;

  for (const c of await deps.repo.dueCampaigns(nowIso)) {
    if (budget <= 0) break;
    if (!(await deps.repo.claim(c.id, nowIso))) continue;
    out.campaigns++;
    const phoneNumberId = sendingAllowed && salt ? await deps.repo.whatsappNumber(c.tenantId) : null;
    if (phoneNumberId) out.realSending = true;
    const done = await deps.repo.alreadyDone(c.id);
    const pending = (await deps.repo.recipients(c.tenantId)).filter((r) => matchesAudience(r, c.audience) && !done.has(r.id));

    for (const r of pending.slice(0, budget)) {
      budget--;
      if (!(await deps.repo.reserve(c, r.id))) continue;
      const para = normalizarTelefonoWhatsApp(r.phone);
      if (!para) { await deps.repo.finish(c.id, r.id, "skipped_no_phone"); out.skipped++; continue; }
      // La baja se revisa siempre que haya sal, también en modo simulado, para que la simulación diga la verdad.
      if (salt && (await deps.repo.optedOut(c.tenantId, hashContactoWhatsApp(salt, c.tenantId, para)))) {
        await deps.repo.finish(c.id, r.id, "skipped_optout"); out.skipped++; continue;
      }
      if (!phoneNumberId) { await deps.repo.finish(c.id, r.id, "simulated"); out.simulated++; continue; }
      const res = await deps.send({ para, plantilla: c.templateName, idioma: c.templateLanguage, phoneNumberId });
      if (res.estado === "aceptado") { await deps.repo.finish(c.id, r.id, "sent", res.id); out.sent++; }
      else if (res.estado === "incierto") { await deps.repo.finish(c.id, r.id, "uncertain"); out.uncertain++; }
      else { await deps.repo.finish(c.id, r.id, "failed"); out.failed++; }
    }
    // Si quedaron destinatarios por falta de presupuesto, la campaña sigue en "sending" y continúa en la próxima ejecución.
    const nowDone = await deps.repo.alreadyDone(c.id);
    if (pending.every((r) => nowDone.has(r.id))) await deps.repo.markDone(c.id, nowIso);
  }
  return out;
}
