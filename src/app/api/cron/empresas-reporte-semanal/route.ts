import { NextResponse } from "next/server";
import { verifyCron } from "@/lib/cron-auth";
import { weekStartChile } from "@/lib/empresas/cartera";
import { loadMembers } from "@/lib/empresas/cartera-data";
import { isEmpresasEnabled } from "@/lib/empresas/flag";
import { buildCompanyReport, reportHtml } from "@/lib/empresas/reporte";
import { getResendClient } from "@/lib/resend-client";
import { createAdminSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Lunes en la mañana: envía a los dueños de cada empresa el reporte de la semana que terminó.
 * Solo empresas con weekly_report_enabled (apagado por defecto). Una vez por empresa y semana (company_report_runs).
 * ?dryRun=1 arma los reportes sin enviar ni anotar nada.
 */
export async function GET(req: Request) {
  const denied = verifyCron(req);
  if (denied) return denied;
  if (!isEmpresasEnabled()) return NextResponse.json({ skipped: "empresas apagado" });
  const dryRun = new URL(req.url).searchParams.get("dryRun") === "1";
  const admin = createAdminSupabase();
  const lastWeek = weekStartChile(Date.now() - 7 * 24 * 3600e3);

  const { data: enabled, error } = await admin.from("company_settings").select("tenant_id").eq("weekly_report_enabled", true);
  if (error) return NextResponse.json({ skipped: "Falta aplicar la migración 158." });
  const out = { week: lastWeek, companies: 0, sent: 0, failed: 0, alreadyDone: 0, dryRun };

  for (const { tenant_id: tenantId } of enabled || []) {
    out.companies++;
    const { data: tenant } = await admin.from("tenants").select("name, kind, status").eq("id", tenantId).maybeSingle();
    if (tenant?.kind !== "company" || tenant.status === "suspended") continue;
    if (!dryRun) {
      // Reclamar la semana antes de enviar: si otra ejecución ya la tomó, la llave primaria lo impide.
      const { error: claimError } = await admin.from("company_report_runs").insert({ tenant_id: tenantId, week_start: lastWeek });
      if (claimError) { out.alreadyDone++; continue; }
    }
    try {
      const report = await buildCompanyReport(admin, tenantId, lastWeek);
      const owners = (await loadMembers(admin, tenantId)).filter((m) => m.active && m.role === "owner" && m.email);
      if (dryRun) continue;
      if (owners.length === 0) throw new Error("sin dueños con correo");
      const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://www.re-booking.cl").replace(/\/$/, "");
      const { error: sendError } = await getResendClient().emails.send({
        from: process.env.EMAIL_FROM || "re-booking <no-reply@re-booking.cl>",
        to: owners.map((o) => o.email),
        subject: `Reporte semanal de vendedores · ${tenant.name}`,
        html: reportHtml(tenant.name, report, `${appUrl}/empresa/reporte`),
      });
      if (sendError) throw new Error(sendError.message);
      await admin.from("company_report_runs").update({ status: "sent" }).eq("tenant_id", tenantId).eq("week_start", lastWeek);
      out.sent++;
    } catch (e) {
      console.error("[empresas] reporte semanal:", tenantId, e instanceof Error ? e.message : "error");
      if (!dryRun) await admin.from("company_report_runs").update({ status: "failed" }).eq("tenant_id", tenantId).eq("week_start", lastWeek);
      out.failed++;
    }
  }
  return NextResponse.json(out);
}
