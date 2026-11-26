import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, requireTenantRole } from "@/lib/supabase/server";
import { efectivoPendiente, resolverEfectivo } from "@/lib/totem-efectivo";

// Pagos en efectivo del tótem que esperan confirmación. Requiere sesión del equipo: un profesional ve y confirma SOLO los suyos;
// administración y recepción, todos los de su negocio. El tótem (público) nunca puede confirmar.
const ROLES = ["admin", "super_admin", "receptionist", "barber"];

export async function GET(req: NextRequest) {
  const guard = await requireTenantRole(ROLES, new URL(req.url).searchParams.get("tenantId"));
  if (!guard.ok) return guard.response;
  const pendientes = await efectivoPendiente(createAdminSupabase(), guard.tenantId, guard.role === "barber" ? guard.userId : null);
  return NextResponse.json({ pendientes }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const guard = await requireTenantRole(ROLES, body.tenantId);
  if (!guard.ok) return guard.response;
  const id = String(body.id || "");
  if (!/^[0-9a-f-]{36}$/i.test(id) || typeof body.coincide !== "boolean") return NextResponse.json({ error: "Falta información" }, { status: 400 });
  const r = await resolverEfectivo(createAdminSupabase(), { tenantId: guard.tenantId, id, coincide: body.coincide, userId: guard.userId, soloBarberId: guard.role === "barber" ? guard.userId : null });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json(r);
}
