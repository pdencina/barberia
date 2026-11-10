import { NextResponse } from "next/server";
import { badRequest, cleanText, dbErrorResponse, missingMigration, readJson } from "@/lib/empresas/errors";
import { requireCompany } from "@/lib/empresas/guard";
import { faltaMigracion } from "@/lib/empresas/settings";
import { createAdminSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Campañas de la empresa con el conteo de destinatarios y de resultados.
export async function GET() {
  const g = await requireCompany("campanas.gestionar");
  if (!g.ok) return g.response;
  const admin = createAdminSupabase();
  const { data, error } = await admin.from("company_campaigns")
    .select("id, name, template_name, template_language, audience, scheduled_at, status, started_at, finished_at, created_at, sends:company_campaign_sends(status)")
    .eq("tenant_id", g.tenantId).order("scheduled_at", { ascending: false }).limit(100);
  if (error) return faltaMigracion(error) ? missingMigration(160) : dbErrorResponse(error, "campañas GET");
  const { count: optedIn } = await admin.from("company_customers").select("id", { count: "exact", head: true })
    .eq("tenant_id", g.tenantId).eq("active", true).eq("whatsapp_opt_in", true);
  return NextResponse.json({
    optedIn: optedIn ?? 0,
    realSending: process.env.EMPRESAS_WHATSAPP_SEND === "1",
    campaigns: (data || []).map((c: any) => {
      const counts: Record<string, number> = {};
      for (const s of c.sends || []) counts[s.status] = (counts[s.status] || 0) + 1;
      const { sends, ...rest } = c;
      return { ...rest, counts };
    }),
  });
}

export async function POST(req: Request) {
  const g = await requireCompany("campanas.gestionar");
  if (!g.ok) return g.response;
  const body = await readJson(req);
  const name = cleanText(body?.name, 120);
  const template = typeof body?.templateName === "string" ? body.templateName.trim() : "";
  const language = typeof body?.templateLanguage === "string" && body.templateLanguage ? body.templateLanguage.trim() : "es";
  const audience = body?.audience;
  const when = typeof body?.scheduledAt === "string" ? Date.parse(body.scheduledAt) : NaN;
  if (!name) return badRequest("Escribe un nombre para la campaña.");
  if (!/^[a-z0-9_]{1,512}$/.test(template)) return badRequest("Escribe el nombre exacto de la plantilla aprobada por Meta (minúsculas, números y _).");
  if (!/^[a-z]{2}(_[A-Z]{2})?$/.test(language)) return badRequest("Idioma no válido (por ejemplo: es o es_CL).");
  if (audience !== "all" && audience !== "clients" && audience !== "distributors") return badRequest("Elige a quién va.");
  if (!Number.isFinite(when) || when < Date.now() - 5 * 60e3 || when > Date.now() + 366 * 86400e3) return badRequest("Elige una fecha y hora futura.");
  const { data, error } = await createAdminSupabase().from("company_campaigns").insert({
    tenant_id: g.tenantId, name, template_name: template, template_language: language, audience,
    scheduled_at: new Date(when).toISOString(), created_by: g.userId,
  }).select("id, status, scheduled_at").single();
  if (error) return faltaMigracion(error) ? missingMigration(160) : dbErrorResponse(error, "campañas POST");
  return NextResponse.json({ campaign: data }, { status: 201 });
}
