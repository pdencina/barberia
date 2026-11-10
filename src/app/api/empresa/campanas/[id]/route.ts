import { NextResponse } from "next/server";
import { badRequest, dbErrorResponse, isUuid, notFound, readJson } from "@/lib/empresas/errors";
import { requireCompany } from "@/lib/empresas/guard";
import { createAdminSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Cancelar una campaña programada (o detener una que va a medias: lo ya enviado no se deshace).
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const g = await requireCompany("campanas.gestionar");
  if (!g.ok) return g.response;
  if (!isUuid(params.id)) return notFound();
  const body = await readJson(req);
  if (body?.action !== "cancel") return badRequest("La acción no es válida.");
  const { data, error } = await createAdminSupabase().from("company_campaigns").update({ status: "cancelled" })
    .eq("tenant_id", g.tenantId).eq("id", params.id).in("status", ["scheduled", "sending"]).select("id");
  if (error) return dbErrorResponse(error, "campaña cancelar");
  if (!data?.length) return NextResponse.json({ error: "Esa campaña ya terminó o no existe." }, { status: 409 });
  return NextResponse.json({ status: "cancelled" });
}
