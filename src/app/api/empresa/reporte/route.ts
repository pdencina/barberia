import { NextResponse } from "next/server";
import { weekStartChile } from "@/lib/empresas/cartera";
import { dbErrorResponse, missingMigration } from "@/lib/empresas/errors";
import { requireCompany } from "@/lib/empresas/guard";
import { buildCompanyReport } from "@/lib/empresas/reporte";
import { faltaMigracion } from "@/lib/empresas/settings";
import { createAdminSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// ?week=YYYY-MM-DD (cualquier día de esa semana; por defecto, la semana en curso).
export async function GET(req: Request) {
  const g = await requireCompany("reporte.ver");
  if (!g.ok) return g.response;
  const w = new URL(req.url).searchParams.get("week");
  const day = w && /^\d{4}-\d{2}-\d{2}$/.test(w) ? Date.parse(`${w}T15:00:00Z`) : Date.now();
  if (!Number.isFinite(day)) return NextResponse.json({ error: "Fecha no válida." }, { status: 400 });
  try {
    return NextResponse.json(await buildCompanyReport(createAdminSupabase(), g.tenantId, weekStartChile(day)));
  } catch (e: any) {
    if (faltaMigracion(e)) return missingMigration(158);
    return dbErrorResponse(e, "reporte GET");
  }
}
