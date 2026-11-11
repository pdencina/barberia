import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, resolveTenantForRequest } from "@/lib/supabase/server";

// GET ?tenantId=: ¿el negocio del usuario tiene el tótem de autoatención desbloqueado? (servicio aparte)
// Lo usan las pantallas internas (lista y ficha de clientes) para mostrar el código del cliente solo a los negocios que lo contrataron.
export async function GET(req: NextRequest) {
  const { tenantId, denied } = await resolveTenantForRequest(new URL(req.url).searchParams.get("tenantId"));
  if (denied || !tenantId || tenantId === "ALL") return NextResponse.json({ activo: false });
  const { data, error } = await createAdminSupabase().from("tenants").select("kiosk_unlocked").eq("id", tenantId).maybeSingle();
  if (error) return NextResponse.json({ activo: false }); // migración 164 aún no aplicada
  return NextResponse.json({ activo: !!(data as any)?.kiosk_unlocked }, { headers: { "Cache-Control": "private, max-age=60" } });
}
