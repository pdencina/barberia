import { NextResponse } from "next/server";
import { getCurrentUserRoleAndTenant } from "@/lib/supabase/server";

// SEGURIDAD: iniciar y cancelar cobros en el terminal de tarjeta (TUU / MercadoPago) no pedia sesion: cualquiera podia mandar un cobro con el monto
// que quisiera al terminal de un negocio, o cancelar los cobros en curso (en MercadoPago, de CUALQUIER negocio). Solo el equipo con sesion.
const STAFF = ["admin", "receptionist", "barber", "super_admin"];
export async function requireStaff(): Promise<
  { ok: true; userId: string; role: string; tenantId: string | null } | { ok: false; response: NextResponse }
> {
  const me = await getCurrentUserRoleAndTenant();
  if (!me.userId) return { ok: false, response: NextResponse.json({ error: "No autenticado" }, { status: 401 }) };
  if (!me.role || !STAFF.includes(me.role)) return { ok: false, response: NextResponse.json({ error: "No autorizado" }, { status: 403 }) };
  return { ok: true, userId: me.userId, role: me.role, tenantId: me.tenantId };
}
