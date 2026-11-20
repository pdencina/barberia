import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, getCurrentUserRoleAndTenant } from "@/lib/supabase/server";
import { restaurarAdmin } from "@/lib/restaurar-admin";

// SEGURIDAD: solo super_admin. Restaura la cuenta del administrador de CUALQUIER empresa (ver src/lib/restaurar-admin.ts).
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const { role } = await getCurrentUserRoleAndTenant();
  if (role !== "super_admin") return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const r = await restaurarAdmin(createAdminSupabase(), params.id);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ success: true, email: r.email, temp_password: r.tempPassword, correoEnviado: r.correoEnviado });
}
