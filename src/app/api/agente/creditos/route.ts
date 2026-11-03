import { NextRequest, NextResponse } from "next/server";
import { resolveTenantForRequest, isManagerLevel } from "@/lib/supabase/server";
import { getEstadoCreditos } from "@/lib/wa-credits";

export const dynamic = "force-dynamic";

// Créditos de WhatsApp del negocio (solo lectura). Administración y recepción.
export async function GET(req: NextRequest) {
  const guard = await isManagerLevel();
  if (!guard.ok) return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  const { tenantId, denied } = await resolveTenantForRequest(req.nextUrl.searchParams.get("tenantId"));
  if (denied || !tenantId || tenantId === "ALL") return NextResponse.json({ error: "Negocio no válido" }, { status: 400 });
  try {
    const estado = await getEstadoCreditos(tenantId);
    return NextResponse.json({ creditos: estado }); // null = migración 010 sin aplicar
  } catch {
    return NextResponse.json({ error: "No se pudo leer los créditos" }, { status: 500 });
  }
}
