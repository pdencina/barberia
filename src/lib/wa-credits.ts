import { createAdminSupabase } from "@/lib/supabase/server";
import { tenantCycleStart, chileDayBoundsUtc, toChileDateStr } from "@/lib/utils";

// Créditos de WhatsApp para los mensajes que envía re-booking por la API de Meta (ver docs/agente/sql/010_creditos_whatsapp.sql).
// 1 crédito = 1 mensaje de utilidad (recordatorio); marketing cuesta `marketingCost` créditos. Apagado por defecto por negocio.
export type TipoCredito = "utility" | "marketing";
export interface EstadoCreditos {
  activo: boolean;
  incluidosMes: number;      // plan + créditos de bienvenida del primer ciclo (o el valor fijado para el negocio)
  usadosMes: number;         // consumidos del cupo mensual en el ciclo actual
  restantesMes: number;
  restantesPacks: number;    // packs vigentes sin gastar
  disponibles: number;       // restantesMes + restantesPacks
  marketingCost: number;
  cicloDesde: string;        // YYYY-MM-DD (Chile)
}
export interface InsumosCreditos { incluidosMes: number; usadosMes: number; packsComprados: number; packsUsados: number }

/** Núcleo puro: cuántos créditos quedan y de dónde sale un gasto. Primero el cupo del mes, luego los packs. */
export function calcularCreditos(i: InsumosCreditos) {
  const restantesMes = Math.max(0, i.incluidosMes - i.usadosMes);
  const restantesPacks = Math.max(0, i.packsComprados - i.packsUsados);
  return { restantesMes, restantesPacks, disponibles: restantesMes + restantesPacks };
}
export function costoEnCreditos(tipo: TipoCredito, marketingCost: number): number { return tipo === "marketing" ? Math.max(1, marketingCost) : 1; }
export function decidirGasto(i: InsumosCreditos, costo: number): { ok: boolean; desdePack: boolean } {
  const c = calcularCreditos(i);
  if (c.restantesMes >= costo) return { ok: true, desdePack: false };
  if (c.restantesPacks >= costo) return { ok: true, desdePack: true };
  return { ok: false, desdePack: false };
}

type Db = ReturnType<typeof createAdminSupabase>;
const faltaMigracion = (e: any) => !!e && ["42P01", "42703", "PGRST204", "PGRST205"].includes(e.code);

async function insumos(db: Db, tenantId: string): Promise<(InsumosCreditos & Omit<EstadoCreditos, "restantesMes" | "restantesPacks" | "disponibles" | "usadosMes" | "incluidosMes">) | null> {
  const t = await db.from("tenants").select("plan,created_at,wa_credits_enabled,wa_credits_override").eq("id", tenantId).maybeSingle();
  if (t.error) { if (faltaMigracion(t.error)) return null; throw new Error("Créditos no disponibles"); }
  if (!t.data) return null;
  const [plan, ajustes] = await Promise.all([
    db.from("wa_credit_plan").select("monthly_credits").eq("plan", (t.data as any).plan).maybeSingle(),
    db.from("wa_credit_settings").select("marketing_cost,welcome_credits").eq("id", 1).maybeSingle(),
  ]);
  if (plan.error || ajustes.error) { if (faltaMigracion(plan.error) || faltaMigracion(ajustes.error)) return null; throw new Error("Créditos no disponibles"); }
  const creado = (t.data as any).created_at as string;
  const cicloDesde = tenantCycleStart(creado);
  const primerCiclo = cicloDesde === toChileDateStr(creado);
  const override = (t.data as any).wa_credits_override;
  const base = typeof override === "number" ? override : Number(plan.data?.monthly_credits ?? 0);
  const incluidosMes = base + (primerCiclo ? Number(ajustes.data?.welcome_credits ?? 0) : 0);
  const { startUtc } = chileDayBoundsUtc(cicloDesde);
  const [uso, packs, packsUso] = await Promise.all([
    db.from("wa_credit_usage").select("credits").eq("tenant_id", tenantId).eq("from_pack", false).gte("created_at", startUtc),
    db.from("wa_credit_packs").select("credits").eq("tenant_id", tenantId).gt("expires_at", new Date().toISOString()),
    db.from("wa_credit_usage").select("credits").eq("tenant_id", tenantId).eq("from_pack", true),
  ]);
  if (uso.error || packs.error || packsUso.error) throw new Error("Créditos no disponibles");
  const suma = (r: any[] | null) => (r ?? []).reduce((a, x) => a + Number(x.credits || 0), 0);
  return {
    activo: (t.data as any).wa_credits_enabled === true, incluidosMes, usadosMes: suma(uso.data),
    packsComprados: suma(packs.data), packsUsados: suma(packsUso.data),
    marketingCost: Number(ajustes.data?.marketing_cost ?? 4), cicloDesde,
  };
}

/** Estado de créditos del negocio (no consume nada). null = migración 010 sin aplicar o negocio inexistente. */
export async function getEstadoCreditos(tenantId: string, db: Db = createAdminSupabase()): Promise<EstadoCreditos | null> {
  const i = await insumos(db, tenantId);
  if (!i) return null;
  return { activo: i.activo, incluidosMes: i.incluidosMes, usadosMes: i.usadosMes, ...calcularCreditos(i), marketingCost: i.marketingCost, cicloDesde: i.cicloDesde };
}

/** ¿Alcanzan los créditos para un mensaje de este tipo? Con el sistema apagado devuelve null (rige el cupo antiguo). */
export async function hayCreditos(tenantId: string, tipo: TipoCredito, db: Db = createAdminSupabase()): Promise<boolean | null> {
  const i = await insumos(db, tenantId);
  if (!i || !i.activo) return null;
  return decidirGasto(i, costoEnCreditos(tipo, i.marketingCost)).ok;
}

/** Gasta los créditos de UN mensaje. true = ok (o ya contado con el mismo reference). false = sin créditos: no enviar. null = sistema apagado. */
export async function tryConsumirCreditos(tenantId: string, tipo: TipoCredito, referenceId?: string, db: Db = createAdminSupabase()): Promise<boolean | null> {
  const i = await insumos(db, tenantId);
  if (!i || !i.activo) return null;
  if (referenceId) {
    const ya = await db.from("wa_credit_usage").select("id").eq("tenant_id", tenantId).eq("tipo", tipo).eq("reference_id", referenceId).maybeSingle();
    if (ya.data) return true;
  }
  const costo = costoEnCreditos(tipo, i.marketingCost);
  const d = decidirGasto(i, costo);
  if (!d.ok) return false;
  const r = await db.from("wa_credit_usage").insert({ tenant_id: tenantId, credits: costo, tipo, from_pack: d.desdePack, reference_id: referenceId ?? null });
  if (r.error) { if ((r.error as any).code === "23505") return true; throw new Error("No se pudo registrar el gasto"); }
  return true;
}
