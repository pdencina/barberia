import { NextResponse } from "next/server";
import { createAdminSupabase, requireRole, resolveTenantForRequest } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/accounting";
import { dateStrOffset, todayInChile } from "@/lib/utils";
import { calcularFrecuencia } from "@/lib/frecuencia";

export const dynamic = "force-dynamic";

// Frecuencia de visita (veces al mes que viene en promedio cada cliente) de todo el negocio. Solo administrador; el negocio sale de la sesión.
export async function GET() {
  const guard = await requireRole(["admin", "super_admin"]);
  if (!guard.ok) return guard.response;
  const { tenantId } = await resolveTenantForRequest(null);
  if (!tenantId || tenantId === "ALL") return NextResponse.json({ meses: [] });

  const sb = createAdminSupabase();
  const hoy = todayInChile();
  try {
    const citas = await fetchAllRows<any>(() => sb.from("appointments").select("id, client_id, date")
      .eq("tenant_id", tenantId).eq("status", "completed").not("client_id", "is", null)
      .gte("date", dateStrOffset(hoy, -400)).lte("date", hoy));
    return NextResponse.json({ meses: calcularFrecuencia(citas, hoy.slice(0, 7)) });
  } catch {
    return NextResponse.json({ meses: [] });
  }
}
