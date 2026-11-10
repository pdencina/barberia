import { NextResponse } from "next/server";
import { createCompanyAccount, MIN_PASSWORD, rollbackAccount } from "@/lib/empresas/accounts";
import { loadMembers } from "@/lib/empresas/cartera-data";
import { badRequest, cleanText, dbErrorResponse, isEmail, readJson } from "@/lib/empresas/errors";
import { requireCompany } from "@/lib/empresas/guard";
import { createAdminSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const ROLES = ["owner", "seller", "warehouse"];

// Lista del equipo. La ven todos los miembros (el vendedor necesita los nombres para la cartera), pero solo el dueño ve correos.
export async function GET() {
  const g = await requireCompany();
  if (!g.ok) return g.response;
  try {
    const members = await loadMembers(createAdminSupabase(), g.tenantId);
    const full = g.role === "owner";
    return NextResponse.json({
      members: members.map((m) => ({ userId: m.userId, name: m.name, role: m.role, active: m.active, ...(full ? { email: m.email } : {}) })),
    });
  } catch (e: any) {
    return dbErrorResponse(e, "usuarios GET");
  }
}

// El dueño crea a una persona del equipo con una contraseña inicial que le entrega en persona.
export async function POST(req: Request) {
  const g = await requireCompany("usuarios.gestionar");
  if (!g.ok) return g.response;
  const body = await readJson(req);
  const name = cleanText(body?.name, 120);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const role = typeof body?.role === "string" ? body.role : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!name) return badRequest("Escribe el nombre.");
  if (!isEmail(email)) return badRequest("Escribe un correo válido.");
  if (!ROLES.includes(role)) return badRequest("Elige un rol.");
  if (password.length < MIN_PASSWORD || password.length > 72) return badRequest(`La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`);

  const admin = createAdminSupabase();
  const created = await createCompanyAccount(admin, { tenantId: g.tenantId, email, name, password });
  if (!created.ok) return NextResponse.json({ error: created.error }, { status: created.status });
  const { error } = await admin.from("company_members").insert({ tenant_id: g.tenantId, user_id: created.userId, role_key: role, active: true });
  if (error) {
    await rollbackAccount(admin, created.userId);
    return dbErrorResponse(error, "usuarios POST");
  }
  return NextResponse.json({ member: { userId: created.userId, name, email, role, active: true } }, { status: 201 });
}
