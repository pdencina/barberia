import { weeklyReport, weekRange, type SellerReport } from "@/lib/empresas/cartera";
import { loadCartera, loadMembers } from "@/lib/empresas/cartera-data";
import type { createAdminSupabase } from "@/lib/supabase/server";

type Admin = ReturnType<typeof createAdminSupabase>;

export type CompanyReport = { weekStart: string; rows: (SellerReport & { name: string })[] };

/** Reporte semanal de una empresa: una fila por vendedor activo (y por dueño que tenga cartera). */
export async function buildCompanyReport(admin: Admin, tenantId: string, weekStart: string): Promise<CompanyReport> {
  const range = weekRange(weekStart);
  const { customers, activities } = await loadCartera(admin, tenantId, { sinceMs: range.from - 24 * 3600e3 });
  const members = (await loadMembers(admin, tenantId)).filter((m) => m.active && (m.role === "seller" || (m.role === "owner" && customers.some((c) => c.assignedSellerId === m.userId))));
  const rows = weeklyReport(members.map((m) => m.userId), customers, activities, range);
  return { weekStart, rows: rows.map((r) => ({ ...r, name: members.find((m) => m.userId === r.sellerId)?.name || "Sin nombre" })) };
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

export function reportHtml(companyName: string, report: CompanyReport, panelUrl: string): string {
  const th = "padding:8px;border-bottom:1px solid #E5E7EB;text-align:left;font-size:12px;color:#6B7280;text-transform:uppercase";
  const td = "padding:8px;border-bottom:1px solid #F3F4F6;font-size:14px;color:#10201F";
  const rows = report.rows.length
    ? report.rows.map((r) => `<tr><td style="${td}">${esc(r.name)}</td><td style="${td}">${r.portfolio}</td><td style="${td}">${r.managed}</td><td style="${td}">${r.sold}</td><td style="${td};color:${r.unattended ? "#B91C1C" : "#10201F"}">${r.unattended}</td><td style="${td}">${r.skipped}</td></tr>`).join("")
    : `<tr><td colspan="6" style="${td}">No hay vendedores con cartera.</td></tr>`;
  return `<!doctype html><html><body style="margin:0;background:#F7F5F0;font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif">
<div style="max-width:640px;margin:0 auto;padding:24px">
<h1 style="font-size:20px;color:#10201F;margin:0 0 4px">Reporte semanal de vendedores</h1>
<p style="font-size:14px;color:#5F6E6C;margin:0 0 16px">${esc(companyName)} · semana del ${esc(report.weekStart)}</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;background:#fff;border-radius:12px;border-collapse:collapse">
<tr><th style="${th}">Vendedor</th><th style="${th}">Cartera</th><th style="${th}">Gestionados</th><th style="${th}">Vendidos</th><th style="${th}">Sin atender</th><th style="${th}">Saltados</th></tr>
${rows}
</table>
<p style="font-size:12px;color:#6B7280;margin:16px 0 0">Los llamados los anota cada vendedor: el sistema no puede comprobar que ocurrieron. Crúzalo con las ventas. <a href="${esc(panelUrl)}" style="color:#0A6E6B">Ver en el panel</a></p>
</div></body></html>`;
}
