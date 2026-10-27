import { NextResponse } from "next/server";
import { createAdminSupabase, authorizeBarberManagement, isManagerLevel } from "@/lib/supabase/server";

// SEGURIDAD: PATCH /api/waitlist y POST /api/waitlist/notify no pedian sesion: con solo el id de una entrada cualquiera podia cambiarla o mandar
// correos y WhatsApp a sus clientes. La lista de espera no tiene `tenant_id` propio, asi que el negocio se deduce del profesional o, si no hay,
// del servicio de la entrada. Solo la gestion de ese negocio (o super admin).
export async function authorizeWaitlistEntry(id: unknown): Promise<{ ok: true } | { ok: false; response: NextResponse }> {
  const me = await isManagerLevel();
  if (!me.userId) return { ok: false, response: NextResponse.json({ error: "No autenticado" }, { status: 401 }) };
  const denied = { ok: false as const, response: NextResponse.json({ error: "No autorizado" }, { status: 403 }) };
  if (!me.ok || typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) return denied;
  const db = createAdminSupabase();
  const { data: entry } = await db.from("waitlist").select("barber_id, service_id").eq("id", id).maybeSingle();
  if (!entry) return denied;
  if (me.role === "super_admin") return { ok: true };
  if ((entry as any).barber_id) return (await authorizeBarberManagement((entry as any).barber_id)).ok ? { ok: true } : denied;
  if ((entry as any).service_id && me.tenantId) {
    const { data: svc } = await db.from("services").select("tenant_id").eq("id", (entry as any).service_id).maybeSingle();
    if ((svc as any)?.tenant_id === me.tenantId) return { ok: true };
  }
  return denied;
}
