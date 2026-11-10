import { NextResponse } from "next/server";
import { badRequest, cleanText, dbErrorResponse, isUuid, notFound, readJson } from "@/lib/empresas/errors";
import { requireCompany } from "@/lib/empresas/guard";
import { createAdminSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Renombrar, cambiar color u orden, o desactivar una marca (no se borra: sus productos la siguen referenciando).
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const g = await requireCompany("productos.editar");
  if (!g.ok) return g.response;
  if (!isUuid(params.id)) return notFound();
  const body = await readJson(req);
  if (!body) return badRequest("No hay cambios.");
  const update: Record<string, unknown> = {};
  if (body.name !== undefined) {
    const name = cleanText(body.name, 80);
    if (!name) return badRequest("Escribe el nombre de la marca.");
    update.name = name;
  }
  if (body.color !== undefined) {
    if (typeof body.color !== "string" || !/^#[0-9A-Fa-f]{6}$/.test(body.color)) return badRequest("Color no válido.");
    update.color = body.color;
  }
  if (body.active !== undefined) {
    if (typeof body.active !== "boolean") return badRequest("Valor no válido.");
    update.active = body.active;
  }
  if (body.sort !== undefined) {
    if (!Number.isInteger(body.sort) || (body.sort as number) < 0 || (body.sort as number) > 1000) return badRequest("Orden no válido.");
    update.sort = body.sort;
  }
  if (Object.keys(update).length === 0) return badRequest("No hay cambios.");
  const { data, error } = await createAdminSupabase().from("company_brands").update(update)
    .eq("tenant_id", g.tenantId).eq("id", params.id).select("id").maybeSingle();
  if (error) {
    if (error.code === "23505") return NextResponse.json({ error: "Ya existe una marca con ese nombre." }, { status: 409 });
    return dbErrorResponse(error, "marca PATCH");
  }
  if (!data) return notFound();
  return NextResponse.json({ ok: true });
}
