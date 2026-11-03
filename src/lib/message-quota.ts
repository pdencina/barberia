import { createAdminSupabase } from "@/lib/supabase/server";
import { chileDayBoundsUtc, tenantCycleStart } from "@/lib/utils";

// Pedido de Nico (27-sep): "sistema de tokens" de mensajeria por negocio, similar a los
// limites de uso de Claude — cada plan trae una cantidad de WhatsApp/correos por mes;
// al agotarla se bloquea el envio hasta el proximo ciclo o hasta comprar mas (decision
// confirmada con Nico: bloquear, no solo avisar).
//
// Alcance confirmado: cuentan las confirmaciones/recordatorios de citas (email +
// WhatsApp) y los envios de retencion/marketing. NO cuentan boletas/recibos ni
// notificaciones internas (bienvenida a un profesional, reseteo de clave).
//
// Hallazgo tecnico importante: WhatsApp aca NUNCA se envia automaticamente — todo lo que
// existe son links wa.me que el staff abre y manda a mano (no hay integracion con
// WhatsApp Business API). Por eso lo unico medible/bloqueable del lado del servidor es la
// GENERACION del link (el momento en que se prepara ese mensaje para un destinatario
// especifico), no si la persona realmente presiono "enviar" en su WhatsApp. Email si es
// 100% automatico (via Resend), asi que ahi se mide el envio real.

export type MessageChannel = "whatsapp" | "email";
export type MessageCategory = "confirmation" | "reminder" | "retention" | "followup";

// Tope mensual de correos de DIFUSION (campañas de retención) por negocio, aparte del cupo general del plan.
// Un campo propio por negocio lo cambia: NULL = este tope; un numero = ese tope; un numero negativo (-1) = sin tope
// (por ejemplo Estudio Levels). Los correos de la difusion siguen contando tambien en el cupo general.
export const TOPE_DIFUSION_CORREOS = 350;

export interface QuotaStatus {
  channel: MessageChannel;
  limit: number | null; // null = ilimitado (Enterprise, o override en 0 tratado como sin limite? no: 0 es un limite valido)
  used: number;
  remaining: number | null; // null = ilimitado
  cycleStart: string; // YYYY-MM-DD (Chile)
}

type Db = ReturnType<typeof createAdminSupabase>;

async function resolvePlanQuota(
  supabase: Db,
  tenantId: string
): Promise<{ whatsapp: number | null; email: number | null; broadcastEmail: number | null; cycleStart: string } | null> {
  const columnas = "plan, created_at, whatsapp_quota_override, email_quota_override";
  let { data: tenant, error } = await supabase
    .from("tenants")
    .select(`${columnas}, broadcast_email_quota_override`)
    .eq("id", tenantId)
    .single();
  // Falta aplicar la migracion 126: se sigue sin la columna y rige el tope por defecto.
  if (error && ["42703", "PGRST204"].includes((error as any).code)) {
    ({ data: tenant } = await supabase.from("tenants").select(columnas).eq("id", tenantId).single());
  }
  if (!tenant) return null;

  const { data: planRow } = await supabase
    .from("plan_limits")
    .select("whatsapp_quota, email_quota")
    .eq("plan", (tenant as any).plan)
    .single();

  // Un override guardado como NULL usa el default del plan; distinto de 0, que es un
  // limite valido (cortar mensajeria para un negocio especifico).
  const t = tenant as any;
  const whatsapp = t.whatsapp_quota_override ?? planRow?.whatsapp_quota ?? null;
  const email = t.email_quota_override ?? planRow?.email_quota ?? null;
  const override = t.broadcast_email_quota_override;
  const broadcastEmail = typeof override === "number" ? (override < 0 ? null : override) : TOPE_DIFUSION_CORREOS;
  const cycleStart = tenantCycleStart(t.created_at);
  return { whatsapp, email, broadcastEmail, cycleStart };
}

async function countUsage(
  supabase: Db,
  tenantId: string,
  channel: MessageChannel,
  cycleStart: string
): Promise<number> {
  const { startUtc } = chileDayBoundsUtc(cycleStart);
  const { count } = await supabase
    .from("message_usage")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("channel", channel)
    .gte("created_at", startUtc);
  return count || 0;
}

async function countUsageCategory(supabase: Db, tenantId: string, channel: MessageChannel, category: MessageCategory, cycleStart: string): Promise<number> {
  const { startUtc } = chileDayBoundsUtc(cycleStart);
  const { count } = await supabase
    .from("message_usage")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("channel", channel)
    .eq("category", category)
    .gte("created_at", startUtc);
  return count || 0;
}

/**
 * Estado del tope de DIFUSION por correo del ciclo actual (no consume nada). `limit` null = sin tope.
 */
export async function getBroadcastStatus(tenantId: string, db: Db = createAdminSupabase()): Promise<QuotaStatus | null> {
  const quota = await resolvePlanQuota(db, tenantId);
  if (!quota) return null;
  const limit = quota.broadcastEmail;
  const used = await countUsageCategory(db, tenantId, "email", "retention", quota.cycleStart);
  return { channel: "email", limit, used, remaining: limit === null ? null : Math.max(0, limit - used), cycleStart: quota.cycleStart };
}

/**
 * Estado de cuota de UN canal (para mostrar la barra de uso en la UI). No consume nada.
 */
export async function getQuotaStatus(tenantId: string, channel: MessageChannel): Promise<QuotaStatus | null> {
  const supabase = createAdminSupabase();
  const quota = await resolvePlanQuota(supabase, tenantId);
  if (!quota) return null;
  const limit = channel === "whatsapp" ? quota.whatsapp : quota.email;
  const used = await countUsage(supabase, tenantId, channel, quota.cycleStart);
  return {
    channel,
    limit,
    used,
    remaining: limit === null ? null : Math.max(0, limit - used),
    cycleStart: quota.cycleStart,
  };
}

/**
 * Cuanto espacio queda AHORA MISMO en el canal (sin consumir nada) — usado antes de
 * generar un lote de links de WhatsApp o una tanda de correos, para saber cuantos caben.
 * Devuelve Infinity si el canal no tiene limite (Enterprise o override explicito).
 */
export async function getRemainingQuota(tenantId: string, channel: MessageChannel): Promise<number> {
  const status = await getQuotaStatus(tenantId, channel);
  if (!status || status.remaining === null) return Infinity;
  return status.remaining;
}

/**
 * Intenta consumir UNA unidad de cuota (un mensaje) y la registra en message_usage si hay
 * espacio. Devuelve false (y no registra nada) si el negocio ya alcanzo el limite del
 * ciclo actual — el llamador debe entonces NO enviar/generar ese mensaje.
 *
 * `referenceId` (opcional) identifica algo que puede volver a pedirse sin ser un envio
 * nuevo — ej. el mismo appointmentId al recargar la pagina de Recordatorios, o el mismo
 * clientId en un reenvio de retencion. Si ya existe un registro con el mismo
 * tenant+channel+category+referenceId en el ciclo actual, se considera ya contado: no
 * inserta de nuevo ni descuenta cupo otra vez, pero igual devuelve true (el llamador puede
 * seguir mostrando/generando ese mensaje puntual).
 */
export async function tryConsumeQuota(
  tenantId: string,
  channel: MessageChannel,
  category: MessageCategory,
  referenceId?: string,
  db: Db = createAdminSupabase()
): Promise<boolean> {
  const supabase = db;
  const quota = await resolvePlanQuota(supabase, tenantId);
  if (!quota) return false; // sin tenant valido, no se envia nada

  if (referenceId) {
    const { startUtc } = chileDayBoundsUtc(quota.cycleStart);
    const { data: existing } = await supabase
      .from("message_usage")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("channel", channel)
      .eq("category", category)
      .eq("reference_id", referenceId)
      .gte("created_at", startUtc)
      .limit(1)
      .maybeSingle();
    if (existing) return true; // ya se conto en este ciclo, no descontar de nuevo
  }

  const limit = channel === "whatsapp" ? quota.whatsapp : quota.email;
  if (limit !== null) {
    const used = await countUsage(supabase, tenantId, channel, quota.cycleStart);
    if (used >= limit) return false;
  }

  // Tope de difusion: los correos de campañas ademas tienen su propio maximo mensual.
  if (channel === "email" && category === "retention" && quota.broadcastEmail !== null) {
    const difusion = await countUsageCategory(supabase, tenantId, "email", "retention", quota.cycleStart);
    if (difusion >= quota.broadcastEmail) return false;
  }

  await supabase.from("message_usage").insert({ tenant_id: tenantId, channel, category, reference_id: referenceId || null });
  return true;
}
