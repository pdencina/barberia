import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, resolveTenantForRequest } from "@/lib/supabase/server";

// GET: List available MP Point devices for a tenant
export async function GET(req: NextRequest) {
  const supabase = createAdminSupabase();
  const { searchParams } = new URL(req.url);
  // Never trust the tenantId coming from the browser — see resolveTenantForRequest.
  const { tenantId } = await resolveTenantForRequest(searchParams.get("tenantId"));

  if (!tenantId || tenantId === "ALL") {
    return NextResponse.json({ error: "tenantId required" }, { status: 400 });
  }

  // Get tenant's MP token
  const { data: settings } = await supabase
    .from("tenant_settings")
    .select("mp_access_token")
    .eq("tenant_id", tenantId)
    .single();

  if (!settings?.mp_access_token) {
    return NextResponse.json({ error: "Primero configura tu Access Token de MercadoPago" }, { status: 400 });
  }

  try {
    // Call MercadoPago API to list devices
    const res = await fetch("https://api.mercadopago.com/point/integration-api/devices", {
      headers: {
        Authorization: `Bearer ${settings.mp_access_token}`,
      },
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      // If the point integration API doesn't work in Chile, try the orders approach
      if (res.status === 403) {
        return NextResponse.json({
          devices: [],
          note: "La API de dispositivos no esta disponible en Chile. Ingresa el Device ID manualmente desde la etiqueta de tu maquina (formato: MARCA__SERIAL, ej: NEWLAND_N950__N950NCC904443218).",
        });
      }
      return NextResponse.json({ error: errData.message || "Error al consultar dispositivos" }, { status: res.status });
    }

    const data = await res.json();
    const devices = (data.devices || []).map((d: any) => ({
      id: d.id,
      operating_mode: d.operating_mode,
      pos_id: d.pos_id,
    }));

    return NextResponse.json({ devices });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error de conexion" }, { status: 500 });
  }
}
