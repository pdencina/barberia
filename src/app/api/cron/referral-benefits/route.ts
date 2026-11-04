import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";
import { verifyCron } from "@/lib/cron-auth";
import { mpReal } from "@/lib/referidos-beneficios";

export const dynamic = "force-dynamic";

// Red de seguridad diaria: si al terminar los meses con descuento no se pudo volver al precio normal (fallo de Mercado Pago), se reintenta aqui.
// Sin NEXT_PUBLIC_REFERIDOS=1 o sin token no hace nada. Idempotente.
export async function GET(req: NextRequest) {
  const denied = verifyCron(req);
  if (denied) return denied;
  const token = process.env.MP_PLATFORM_ACCESS_TOKEN;
  if (process.env.NEXT_PUBLIC_REFERIDOS !== "1" || !token) return NextResponse.json({ omitido: true });

  const db = createAdminSupabase();
  const { data, error } = await db.from("referrals").select("id, referred_tenant_id, full_amount, discount_months, discount_charges")
    .is("discount_ended_at", null).gt("discount_months", 0).not("referred_tenant_id", "is", null).limit(200);
  if (error) return NextResponse.json({ migracionPendiente: true });

  const mp = mpReal(token);
  let corregidos = 0, fallidos = 0;
  for (const r of (data as any[]) || []) {
    if ((r.discount_charges || 0) < r.discount_months) continue;
    const { data: sub } = await db.from("subscriptions").select("mp_preapproval_id").eq("tenant_id", r.referred_tenant_id).not("mp_preapproval_id", "is", null).maybeSingle();
    if (!sub?.mp_preapproval_id || !r.full_amount) continue;
    if (await mp.subirMonto(sub.mp_preapproval_id, r.full_amount)) { await db.from("referrals").update({ discount_ended_at: new Date().toISOString() }).eq("id", r.id); corregidos++; }
    else fallidos++;
  }
  return NextResponse.json({ corregidos, fallidos });
}
