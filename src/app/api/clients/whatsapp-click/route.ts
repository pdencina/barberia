import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, getCurrentUserRoleAndTenant } from "@/lib/supabase/server";
import { LITE_WHATSAPP_MES } from "@/lib/plan-lite";
import { chileDayBoundsUtc, todayInChile } from "@/lib/utils";

export const dynamic = "force-dynamic";

// Plan Lite: el botón WhatsApp de la ficha del cliente se puede usar LITE_WHATSAPP_MES (20) veces al mes. En los demás planes no se cuenta.
// Lleva su propio conteo (en message_usage) y rige desde ya: no depende del periodo de gracia de los topes de mensajes del resto de los planes.
export async function POST(_req: NextRequest) {
  const s = await getCurrentUserRoleAndTenant();
  if (!s.userId || !s.tenantId || s.tenantId === "ALL") return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const sb = createAdminSupabase();
  const { data: t } = await sb.from("tenants").select("plan").eq("id", s.tenantId).maybeSingle();
  if ((t as any)?.plan !== "lite") return NextResponse.json({ ok: true, ilimitado: true });

  const inicioMes = chileDayBoundsUtc(`${todayInChile().slice(0, 7)}-01`).startUtc;
  const { count } = await sb.from("message_usage").select("id", { count: "exact", head: true })
    .eq("tenant_id", s.tenantId).eq("channel", "whatsapp").eq("category", "followup").gte("created_at", inicioMes);   // un negocio Lite no tiene otros WhatsApp de seguimiento
  const usados = count || 0;
  if (usados >= LITE_WHATSAPP_MES) {
    return NextResponse.json({ error: "Ups, se te acabaron las oportunidades. Si quieres más, mejora tu plan y desbloquea más beneficios.", code: "plan_limit", restantes: 0 }, { status: 429 });
  }
  // reference_id es un uuid: cada uso lleva el suyo, así ninguno se confunde con otro.
  const { error } = await sb.from("message_usage").insert({ tenant_id: s.tenantId, channel: "whatsapp", category: "followup", reference_id: crypto.randomUUID() });
  if (error) return NextResponse.json({ error: "No se pudo registrar el uso. Intenta de nuevo." }, { status: 500 });
  return NextResponse.json({ ok: true, restantes: LITE_WHATSAPP_MES - usados - 1 });
}
