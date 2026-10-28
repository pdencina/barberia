import { NextResponse } from "next/server";
import { createAdminSupabase, requireRole, resolveTenantForRequest } from "@/lib/supabase/server";
import { urlInvitacion, PREMIO } from "@/lib/referidos";
import { nuevoCodigo } from "@/lib/referidos-servidor";

export const dynamic = "force-dynamic";

// Codigo y resumen de referidos del negocio de la sesion. Solo administrador. Tolera que falte la migracion 120.
export async function GET(req: Request) {
  const guard = await requireRole(["admin", "super_admin"]);
  if (!guard.ok) return guard.response;
  const { tenantId } = await resolveTenantForRequest(null);
  if (!tenantId || tenantId === "ALL") return NextResponse.json({ error: "Elige un negocio" }, { status: 400 });

  const supabase = createAdminSupabase();
  const { data: t, error } = await supabase.from("tenants").select("id, referral_code").eq("id", tenantId).maybeSingle();
  if (error) return NextResponse.json({ migracionPendiente: true, error: "Falta aplicar la migración 120" }, { status: 200 });
  if (!t) return NextResponse.json({ error: "Negocio no encontrado" }, { status: 404 });

  let codigo = t.referral_code as string | null;
  for (let i = 0; !codigo && i < 5; i++) {
    const intento = nuevoCodigo();
    const { error: e } = await supabase.from("tenants").update({ referral_code: intento }).eq("id", tenantId).is("referral_code", null);
    if (!e) {
      const { data: again } = await supabase.from("tenants").select("referral_code").eq("id", tenantId).maybeSingle();
      codigo = (again?.referral_code as string | null) ?? null;
    }
  }
  if (!codigo) return NextResponse.json({ error: "No pude crear tu código" }, { status: 500 });

  const { data: filas } = await supabase.from("referrals").select("status, created_at").eq("referrer_tenant_id", tenantId).order("created_at", { ascending: false }).limit(200);
  const lista = (filas as any[]) || [];
  // Meses gratis ganados (etapa 3). Si falta la migracion 121, simplemente no hay datos.
  const { data: cr } = await supabase.from("referral_credits").select("status").eq("tenant_id", tenantId).limit(200);
  const creditos = (cr as any[]) || [];
  const origen = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;
  return NextResponse.json({
    codigo, enlace: urlInvitacion(origen, codigo), premio: PREMIO,
    invitados: lista.length, pagaron: lista.filter((f) => f.status === "pagado").length,
    mesesGratisDisponibles: creditos.filter((c) => c.status === "disponible").length,
    mesesGratisAplicados: creditos.filter((c) => c.status === "aplicado").length,
  });
}
