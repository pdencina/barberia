import { NextRequest, NextResponse } from "next/server";
import { resolveTenantForRequest, isManagerLevel } from "@/lib/supabase/server";

/** Acceso común de las rutas de conversaciones: solo administración y siempre el negocio de la sesión. */
export async function contextoChats(req: NextRequest): Promise<{ tenantId: string } | { error: NextResponse }> {
  const g = await isManagerLevel();
  if (!g.ok || g.role === "receptionist") return { error: NextResponse.json({ error: "Solo administración" }, { status: 403 }) };
  const { tenantId, denied } = await resolveTenantForRequest(req.nextUrl.searchParams.get("tenantId"));
  if (denied || !tenantId || tenantId === "ALL") return { error: NextResponse.json({ error: "Negocio no válido" }, { status: 400 }) };
  return { tenantId };
}
export const MARCA_MANUAL = "[manual] ";
export const VENTANA_RESPUESTA_MS = 24 * 3600000; // Meta solo deja escribir libremente si el cliente escribió en las últimas 24 h
