import type { createAdminSupabase } from "@/lib/supabase/server";
import { couponDiscountText } from "@/lib/retention-message";
import { couponKind } from "@/lib/coupon";

// Historial de campanas de Retencion (tablas de la migracion 115). TODO tolera que la migracion no este aplicada:
// el envio masivo funciona igual, solo que no queda historial (nunca se rompe un envio por no poder registrarlo).

type Db = ReturnType<typeof createAdminSupabase>;

/** Dias hacia atras en que se avisa "ya recibio una campana". */
export const RECENT_DAYS = 30;

export interface CampaignRecipientInput { clientId: string | null; name: string; contact: string | null; status: "sent" | "failed" }

/** Nombre de la campana tal como se guarda: sin espacios sobrantes ni saltos de linea, con tope de largo. Vacio = sin nombre. */
export function cleanCampaignName(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const n = v.replace(/\s+/g, " ").trim().slice(0, 120);
  return n || null;
}

export interface CampaignInput {
  tenantId: string;
  name?: string | null;
  userId: string | null;
  userName: string | null;
  channel: "email" | "whatsapp";
  message: string | null;
  couponCode: string | null;
  couponDetail: string | null;
  rangeMinDays: number | null;
  rangeMaxDays: number | null;
  includeNever: boolean;
  plannedTotal: number;
  sentCount: number;
  failedCount: number;
  quotaExceeded: boolean;
  excludedCount: number;
  manualCount: number;
  recipients: CampaignRecipientInput[];
}

/** El cupon tal como estaba al enviar: "CEJAS GRATIS · $1.000 de descuento", o su descripcion si no tiene monto. */
export function couponSnapshot(coupon: { code: string; description?: string | null; discount_type?: string | null; discount_value?: number | null } | null | undefined): string | null {
  if (!coupon) return null;
  const money = couponDiscountText(coupon);
  const desc = (coupon.description || "").trim();
  if (couponKind(coupon) === "none") return desc ? `${coupon.code} · ${desc}` : coupon.code;
  return `${coupon.code} · ${money}`;
}

/** Guarda la campana y sus destinatarios. Devuelve el id, o null si no se pudo (por ejemplo, falta la migracion 115). Nunca lanza error. */
export async function recordCampaign(supabase: Db, c: CampaignInput): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from("retention_campaigns")
      .insert({
        tenant_id: c.tenantId,
        channel: c.channel,
        created_by: c.userId,
        created_by_name: c.userName,
        name: cleanCampaignName(c.name),
        message: c.message,
        coupon_code: c.couponCode,
        coupon_detail: c.couponDetail,
        range_min_days: c.rangeMinDays,
        range_max_days: c.rangeMaxDays,
        include_never: c.includeNever,
        planned_total: c.plannedTotal,
        sent_count: c.sentCount,
        failed_count: c.failedCount,
        quota_exceeded: c.quotaExceeded,
        excluded_count: c.excludedCount,
        manual_count: c.manualCount,
        source: "app",
      })
      .select("id")
      .single();
    if (error || !data) {
      console.warn("No se pudo registrar la campana (¿falta la migracion 115?):", error?.message);
      return null;
    }
    const id = (data as any).id as string;
    for (let i = 0; i < c.recipients.length; i += 500) {
      const chunk = c.recipients.slice(i, i + 500).map((r) => ({
        campaign_id: id, tenant_id: c.tenantId, client_id: r.clientId, name: r.name, contact: r.contact, status: r.status,
      }));
      const { error: rErr } = await supabase.from("retention_campaign_recipients").insert(chunk);
      if (rErr) console.warn("No se pudieron registrar los destinatarios de la campana:", rErr.message);
    }
    return id;
  } catch (e) {
    console.warn("Error registrando la campana:", e);
    return null;
  }
}

export interface CampaignRow {
  id: string;
  name: string | null;
  channel: "email" | "whatsapp";
  createdAt: string;
  createdByName: string | null;
  message: string | null;
  couponCode: string | null;
  couponDetail: string | null;
  rangeMinDays: number | null;
  rangeMaxDays: number | null;
  includeNever: boolean;
  plannedTotal: number;
  sentCount: number;
  failedCount: number;
  quotaExceeded: boolean;
  excludedCount: number;
  manualCount: number;
  source: string;
}

const COLS = "id, name, channel, created_at, created_by_name, message, coupon_code, coupon_detail, range_min_days, range_max_days, include_never, planned_total, sent_count, failed_count, quota_exceeded, excluded_count, manual_count, source";

function toCampaign(r: any): CampaignRow {
  return {
    id: r.id, name: r.name ?? null, channel: r.channel, createdAt: r.created_at, createdByName: r.created_by_name ?? null,
    message: r.message ?? null, couponCode: r.coupon_code ?? null, couponDetail: r.coupon_detail ?? null,
    rangeMinDays: r.range_min_days ?? null, rangeMaxDays: r.range_max_days ?? null, includeNever: !!r.include_never,
    plannedTotal: Number(r.planned_total) || 0, sentCount: Number(r.sent_count) || 0, failedCount: Number(r.failed_count) || 0,
    quotaExceeded: !!r.quota_exceeded, excludedCount: Number(r.excluded_count) || 0, manualCount: Number(r.manual_count) || 0,
    source: r.source || "app",
  };
}

export async function listCampaigns(supabase: Db, tenantId: string, limit = 100): Promise<{ campaigns: CampaignRow[]; migrationMissing: boolean }> {
  const { data, error } = await supabase
    .from("retention_campaigns")
    .select(COLS)
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return { campaigns: [], migrationMissing: /does not exist|schema cache|relation/i.test(error.message) };
  return { campaigns: ((data as any[]) || []).map(toCampaign), migrationMissing: false };
}

export interface CampaignRecipientRow { id: string; clientId: string | null; name: string | null; contact: string | null; status: "sent" | "failed" }

export async function getCampaignDetail(supabase: Db, tenantId: string, id: string): Promise<{ campaign: CampaignRow; recipients: CampaignRecipientRow[] } | null> {
  const { data } = await supabase.from("retention_campaigns").select(COLS).eq("tenant_id", tenantId).eq("id", id).maybeSingle();
  if (!data) return null;
  const { data: rec } = await supabase
    .from("retention_campaign_recipients")
    .select("id, client_id, name, contact, status")
    .eq("campaign_id", id)
    .eq("tenant_id", tenantId)
    .order("name", { ascending: true })
    .limit(5000);
  return {
    campaign: toCampaign(data),
    recipients: ((rec as any[]) || []).map((r) => ({ id: r.id, clientId: r.client_id ?? null, name: r.name ?? null, contact: r.contact ?? null, status: r.status })),
  };
}

export interface RecentContact { at: string; couponCode: string | null; campaignId: string }

/** De esos clientes, a quienes ya se les envio una campana en los ultimos `days` dias (la mas reciente de cada uno). */
export async function recentlyContacted(supabase: Db, tenantId: string, clientIds: string[], days = RECENT_DAYS): Promise<Map<string, RecentContact>> {
  const out = new Map<string, RecentContact>();
  const ids = Array.from(new Set(clientIds.filter(Boolean)));
  if (ids.length === 0) return out;
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += 100) chunks.push(ids.slice(i, i + 100));
  try {
    const results = await Promise.all(chunks.map((chunk) =>
      supabase
        .from("retention_campaign_recipients")
        .select("client_id, created_at, campaign_id, campaign:retention_campaigns(coupon_code)")
        .eq("tenant_id", tenantId)
        .eq("status", "sent")
        .gte("created_at", since)
        .in("client_id", chunk)
        .order("created_at", { ascending: false })
    ));
    for (const { data, error } of results) {
      if (error) return new Map(); // falta la migracion 115: sin historial no hay aviso
      for (const r of (data as any[]) || []) {
        if (!r.client_id) continue;
        const prev = out.get(r.client_id);
        if (!prev || r.created_at > prev.at) {
          const camp = Array.isArray(r.campaign) ? r.campaign[0] : r.campaign;
          out.set(r.client_id, { at: r.created_at, couponCode: camp?.coupon_code ?? null, campaignId: r.campaign_id });
        }
      }
    }
  } catch {
    return new Map();
  }
  return out;
}
