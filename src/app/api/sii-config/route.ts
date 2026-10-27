import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, getCurrentUserRoleAndTenant } from "@/lib/supabase/server";
import { encryptSecret, secretBoxReady } from "@/lib/secret-box";

export const dynamic = "force-dynamic";

const PUBLIC_COLS =
  "enabled, auto_emit, provider, environment, emisor_rut, emisor_razon_social, emisor_giro, emisor_direccion, emisor_comuna";

async function adminTenant() {
  const { userId, role, tenantId } = await getCurrentUserRoleAndTenant();
  if (!userId || !tenantId || (role !== "admin" && role !== "super_admin")) return null;
  return tenantId;
}

// GET: configuración SII del negocio. La llave nunca se devuelve, solo si está cargada.
export async function GET() {
  const tenantId = await adminTenant();
  if (!tenantId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { data, error } = await createAdminSupabase()
    .from("tenant_billing_sii")
    .select(`${PUBLIC_COLS}, api_key_enc`)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) return NextResponse.json({ error: "Falta aplicar la migración 116" }, { status: 503 });
  const { api_key_enc, ...rest } = (data || {}) as any;
  return NextResponse.json({ config: data ? { ...rest, has_api_key: !!api_key_enc } : null, encryption_ready: secretBoxReady() });
}

// PUT: guarda datos del emisor, ambiente e interruptores. api_key vacía = conservar la actual.
export async function PUT(req: NextRequest) {
  const tenantId = await adminTenant();
  if (!tenantId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const b = await req.json().catch(() => ({}));

  const row: Record<string, any> = { tenant_id: tenantId, updated_at: new Date().toISOString() };
  for (const k of ["emisor_rut", "emisor_razon_social", "emisor_giro", "emisor_direccion", "emisor_comuna"]) {
    if (typeof b[k] === "string") row[k] = b[k].trim() || null;
  }
  if (b.environment === "sandbox" || b.environment === "production") row.environment = b.environment;
  if (typeof b.enabled === "boolean") row.enabled = b.enabled;
  if (typeof b.auto_emit === "boolean") row.auto_emit = b.auto_emit;
  if (typeof b.api_key === "string" && b.api_key.trim()) {
    if (!secretBoxReady()) {
      return NextResponse.json({ error: "Falta SECRET_BOX_KEY en el servidor (la configura Pablo en Vercel)" }, { status: 503 });
    }
    row.api_key_enc = encryptSecret(b.api_key.trim());
  }

  const { error } = await createAdminSupabase().from("tenant_billing_sii").upsert(row, { onConflict: "tenant_id" });
  if (error) return NextResponse.json({ error: "Falta aplicar la migración 116" }, { status: 503 });
  return NextResponse.json({ success: true });
}
