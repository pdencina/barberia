import { NextResponse } from "next/server";
import { MIN_PASSWORD } from "@/lib/empresas/accounts";
import { badRequest, dbErrorResponse, isUuid, notFound, readJson } from "@/lib/empresas/errors";
import { requireCompany } from "@/lib/empresas/guard";
import { createAdminSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const ROLES = ["owner", "seller", "warehouse"];

// Cambiar rol, desactivar/reactivar o poner una contraseña nueva. Siempre debe quedar al menos un dueño activo.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const g = await requireCompany("usuarios.gestionar");
  if (!g.ok) return g.response;
  if (!isUuid(params.id)) return notFound();
  const body = await readJson(req);
  const admin = createAdminSupabase();

  const { data: member, error } = await admin.from("company_members").select("user_id, role_key, active")
    .eq("tenant_id", g.tenantId).eq("user_id", params.id).maybeSingle();
  if (error) return dbErrorResponse(error, "usuario PATCH");
  if (!member) return notFound();

  const update: Record<string, unknown> = {};
  if (body?.role !== undefined) {
    if (typeof body.role !== "string" || !ROLES.includes(body.role)) return badRequest("Elige un rol.");
    update.role_key = body.role;
  }
  if (body?.active !== undefined) {
    if (typeof body.active !== "boolean") return badRequest("Valor no válido.");
    update.active = body.active;
  }
  const password = body?.password;
  if (password !== undefined && (typeof password !== "string" || password.length < MIN_PASSWORD || password.length > 72)) {
    return badRequest(`La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`);
  }
  if (Object.keys(update).length === 0 && password === undefined) return badRequest("No hay cambios.");

  const losesOwner = member.role_key === "owner" && member.active && (update.role_key !== undefined && update.role_key !== "owner" || update.active === false);
  if (losesOwner) {
    const { count, error: countError } = await admin.from("company_members").select("user_id", { count: "exact", head: true })
      .eq("tenant_id", g.tenantId).eq("role_key", "owner").eq("active", true);
    if (countError) return dbErrorResponse(countError, "usuario PATCH dueños");
    if ((count ?? 0) <= 1) return NextResponse.json({ error: "Debe quedar al menos un dueño activo." }, { status: 409 });
  }

  if (Object.keys(update).length > 0) {
    const { error: updateError } = await admin.from("company_members").update(update).eq("tenant_id", g.tenantId).eq("user_id", params.id);
    if (updateError) return dbErrorResponse(updateError, "usuario PATCH");
  }
  if (typeof password === "string") {
    const { error: passError } = await admin.auth.admin.updateUserById(params.id, { password });
    if (passError) return badRequest(`La contraseña debe tener al menos ${MIN_PASSWORD} caracteres y no ser demasiado simple.`);
  }
  return NextResponse.json({ ok: true });
}
