import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";
import { getTenantFromRequest } from "@/lib/tenant-filter";

export async function POST(req: NextRequest) {
  const supabase = createAdminSupabase();
  const { pin } = await req.json();

  if (!pin) return NextResponse.json({ valid: false, error: "PIN requerido" });

  // Scope the PIN check to THIS business. Without it, a PIN was matched across every
  // salon, so e.g. Dylan's PIN (Estudio Levels) opened Standby inside Saray's account.
  // Also, two barbers in different businesses can legitimately share a PIN, which made
  // .single() throw. We filter by tenant and take the first match within it.
  const tenantId = await getTenantFromRequest(req);
  if (!tenantId || tenantId === "ALL") {
    return NextResponse.json({ valid: false, error: "No se pudo identificar el negocio" });
  }

  const { data: matches } = await supabase
    .from("profiles")
    .select("id, name")
    .eq("personal_pin", pin)
    .eq("role", "barber")
    .eq("active", true)
    .eq("tenant_id", tenantId)
    .limit(1);

  const barber = matches && matches.length > 0 ? matches[0] : null;
  if (!barber) {
    return NextResponse.json({ valid: false, error: "Codigo incorrecto" });
  }

  return NextResponse.json({ valid: true, barber });
}
