import { NextResponse } from "next/server";
import { createAdminSupabase, requireRole, resolveTenantForRequest } from "@/lib/supabase/server";
import { diagnosticar, resumenDiagnostico } from "@/lib/oti/diagnostico";
import { cargarInstantanea } from "@/lib/oti/instantanea";

export const dynamic = "force-dynamic";

// «Mis clientes no pueden reservar»: Oti revisa el negocio de quien pregunta (solo administrador; el negocio sale de la sesion) y devuelve lo que encontro.
// Solo LEE: nunca cambia nada.
export async function GET() {
  const guard = await requireRole(["admin", "super_admin"]);
  if (!guard.ok) return guard.response;
  const { tenantId } = await resolveTenantForRequest(null);
  if (!tenantId || tenantId === "ALL") return NextResponse.json({ error: "Elige un negocio para revisarlo." }, { status: 400 });
  const hallazgos = diagnosticar(await cargarInstantanea(createAdminSupabase(), tenantId));
  return NextResponse.json({ hallazgos, texto: resumenDiagnostico(hallazgos) });
}
