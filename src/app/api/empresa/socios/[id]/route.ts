import { NextResponse } from "next/server";
import { MIN_PASSWORD } from "@/lib/empresas/accounts";
import { badRequest, dbErrorResponse, isUuid, notFound, readJson } from "@/lib/empresas/errors";
import { requireCompany } from "@/lib/empresas/guard";
import { createAdminSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Activar/desactivar el acceso de un distribuidor o ponerle una contraseña nueva.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const g = await requireCompany("socios.gestionar");
  if (!g.ok) return g.response;
  if (!isUuid(params.id)) return notFound();
  const body = await readJson(req);
  const admin = createAdminSupabase();
  const { data: link, error } = await admin.from("company_partner_users").select("user_id").eq("tenant_id", g.tenantId).eq("user_id", params.id).maybeSingle();
  if (error) return dbErrorResponse(error, "socio PATCH");
  if (!link) return notFound();
  if (body?.active === undefined && body?.password === undefined) return badRequest("No hay cambios.");
  if (body?.active !== undefined) {
    if (typeof body.active !== "boolean") return badRequest("Valor no válido.");
    const { error: upError } = await admin.from("company_partner_users").update({ active: body.active }).eq("tenant_id", g.tenantId).eq("user_id", params.id);
    if (upError) return dbErrorResponse(upError, "socio PATCH");
  }
  if (body?.password !== undefined) {
    const pw = body.password;
    if (typeof pw !== "string" || pw.length < MIN_PASSWORD || pw.length > 72) return badRequest(`La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`);
    const { error: pwError } = await admin.auth.admin.updateUserById(params.id, { password: pw });
    if (pwError) return badRequest(`La contraseña debe tener al menos ${MIN_PASSWORD} caracteres y no ser demasiado simple.`);
  }
  return NextResponse.json({ ok: true });
}
