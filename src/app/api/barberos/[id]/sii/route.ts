import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, getCurrentUserRoleAndTenant } from "@/lib/supabase/server";
import { encryptSecret, secretBoxReady } from "@/lib/secret-box";

export const dynamic = "force-dynamic";

const COLS = "enabled, auto_emit, environment, emisor_rut, emisor_razon_social, emisor_giro, emisor_direccion, emisor_comuna, api_key_enc";

// SEGURIDAD: la cuenta SII de un profesional la ve y la cambia SOLO el administrador de su negocio
// (o super_admin). Ni el propio profesional ni recepción: así no puede apagarla o cambiarla sin acuerdo.
async function authorize(barberId: string) {
  const { userId, role, tenantId } = await getCurrentUserRoleAndTenant();
  if (!userId || (role !== "admin" && role !== "super_admin")) return null;
  const { data: barber } = await createAdminSupabase().from("profiles").select("tenant_id").eq("id", barberId).maybeSingle();
  if (!barber?.tenant_id) return null;
  if (role !== "super_admin" && barber.tenant_id !== tenantId) return null;
  return { userId, tenantId: barber.tenant_id as string };
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authorize(params.id);
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const supabase = createAdminSupabase();
  const { data, error } = await supabase.from("professional_billing_sii").select(COLS).eq("profile_id", params.id).maybeSingle();
  if (error) return NextResponse.json({ error: "Falta aplicar la migración 118" }, { status: 503 });
  const { data: prof } = await supabase.from("profiles").select("tax_bearer, tax_rate").eq("id", params.id).maybeSingle();
  const { api_key_enc, ...rest } = (data || {}) as any;
  return NextResponse.json({
    tax_rate: Number((prof as any)?.tax_rate) || 0,
    tax_bearer: (prof as any)?.tax_bearer || "business",
    config: data ? { ...rest, has_api_key: !!api_key_enc } : null,
    encryption_ready: secretBoxReady(),
  });
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authorize(params.id);
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const supabase = createAdminSupabase();

  // Con retencion de honorarios el negocio es quien le vende al cliente (el profesional solo le cobra su comision):
  // la boleta del cliente no puede salir con la cuenta del profesional.
  if (b.tax_bearer === "professional") {
    const { data: p } = await supabase.from("profiles").select("sii_enabled, tax_rate").eq("id", params.id).maybeSingle();
    const rate = Number((p as any)?.tax_rate) || 0;
    if ((p as any)?.sii_enabled && rate > 0 && rate !== 19) {
      return NextResponse.json({ error: "Con retención de honorarios la boleta al cliente sale con la cuenta del negocio. Cambia la tasa a IVA 19 % o deja que el negocio asuma." }, { status: 400 });
    }
  }
  if (b.tax_bearer === "business" || b.tax_bearer === "professional") {
    const { error } = await supabase.from("profiles").update({ tax_bearer: b.tax_bearer }).eq("id", params.id);
    if (error) return NextResponse.json({ error: "Falta aplicar la migración 118" }, { status: 503 });
  }

  const row: Record<string, any> = { profile_id: params.id, tenant_id: auth.tenantId, updated_by: auth.userId, updated_at: new Date().toISOString() };
  for (const k of ["emisor_rut", "emisor_razon_social", "emisor_giro", "emisor_direccion", "emisor_comuna"]) {
    if (typeof b[k] === "string") row[k] = b[k].trim() || null;
  }
  if (b.environment === "sandbox" || b.environment === "production") row.environment = b.environment;
  if (typeof b.enabled === "boolean") row.enabled = b.enabled;
  if (typeof b.auto_emit === "boolean") row.auto_emit = b.auto_emit;
  if (typeof b.api_key === "string" && b.api_key.trim()) {
    if (!secretBoxReady()) return NextResponse.json({ error: "Falta SECRET_BOX_KEY en el servidor (la configura Pablo en Vercel)" }, { status: 503 });
    row.api_key_enc = encryptSecret(b.api_key.trim());
  }
  const { error } = await supabase.from("professional_billing_sii").upsert(row, { onConflict: "profile_id" });
  if (error) return NextResponse.json({ error: "Falta aplicar la migración 118" }, { status: 503 });
  return NextResponse.json({ success: true });
}
