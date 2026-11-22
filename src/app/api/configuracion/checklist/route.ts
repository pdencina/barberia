import { NextResponse } from "next/server";
import { createAdminSupabase, requireRole, resolveTenantForRequest } from "@/lib/supabase/server";
import { cargarInstantanea } from "@/lib/oti/instantanea";
import { construirChecklist } from "@/lib/configuracion-inicial";

export const dynamic = "force-dynamic";

// Checklist de configuracion inicial del negocio de quien pregunta (solo administrador; el negocio sale de la sesion). Solo LEE.
export async function GET() {
  const guard = await requireRole(["admin", "super_admin"]);
  if (!guard.ok) return guard.response;
  const { tenantId } = await resolveTenantForRequest(null);
  if (!tenantId || tenantId === "ALL") return NextResponse.json({ error: "Elige un negocio." }, { status: 400 });
  const pasos = construirChecklist(await cargarInstantanea(createAdminSupabase(), tenantId));
  return NextResponse.json({ pasos });
}
