import { NextResponse } from "next/server";
import { createAdminSupabase, requireRole } from "@/lib/supabase/server";

// SECURITY: PATCH/DELETE /api/services/[id] y las fotos del servicio usaban la llave de servicio sin pedir sesion ni negocio:
// con solo conocer el id de un servicio se podia editarlo, desactivarlo o cambiarle la foto, de cualquier negocio.
// Ahora: solo admin o super_admin, y el servicio debe ser del negocio del que llama (el super_admin puede con cualquiera).
// Si el servicio no existe o es de otro negocio se responde 404 igual, para no revelar que existe.
export interface AuthorizedService { id: string; name: string; price: number; tenant_id: string | null }

export async function authorizeServiceAccess(serviceId: string): Promise<
  { ok: true; service: AuthorizedService } | { ok: false; response: NextResponse }
> {
  const g = await requireRole(["admin", "super_admin"]);
  if (!g.ok) return g;

  const notFound = { ok: false as const, response: NextResponse.json({ error: "Servicio no encontrado" }, { status: 404 }) };
  if (!/^[0-9a-f-]{36}$/i.test(serviceId)) return notFound;

  const { data } = await createAdminSupabase()
    .from("services")
    .select("id, name, price, tenant_id")
    .eq("id", serviceId)
    .maybeSingle();
  if (!data) return notFound;
  if (g.role !== "super_admin" && (!data.tenant_id || data.tenant_id !== g.tenantId)) return notFound;
  return { ok: true, service: data as AuthorizedService };
}
