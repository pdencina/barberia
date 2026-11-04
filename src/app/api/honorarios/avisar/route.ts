import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, getCurrentUserRoleAndTenant } from "@/lib/supabase/server";
import { computeProMonths } from "@/lib/ledger";
import { sendHonorariosNotice } from "@/lib/resend";

export const dynamic = "force-dynamic";

const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

// POST: avisa por correo a los profesionales por comisión con retención que AÚN NO entregaron su boleta del mes.
// SEGURIDAD: solo administrador del negocio. Los montos se calculan aquí, nunca se toman del navegador.
export async function POST(req: NextRequest) {
  const { userId, role, tenantId: callerTenant } = await getCurrentUserRoleAndTenant();
  if (!userId || (role !== "admin" && role !== "super_admin")) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const tenantId = role === "super_admin" ? b.tenantId || callerTenant : callerTenant;
  const year = Number(b.year), month = Number(b.month);
  if (!tenantId || tenantId === "ALL" || !(year > 2000) || !(month >= 1 && month <= 12)) {
    return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
  }
  const only: string[] | null = Array.isArray(b.profileIds) ? b.profileIds.map(String) : null;
  const supabase = createAdminSupabase();
  const first = `${year}-${String(month).padStart(2, "0")}-01`;

  const pros = (await computeProMonths(supabase, { tenantId, mode: "commission", year, month }))
    .filter((p) => p.tax && p.tax.kind === "retencion" && p.tax.base > 0 && (!only || only.includes(p.barberId)));
  if (pros.length === 0) return NextResponse.json({ sent: 0, failed: [], noEmail: [], alreadyReceived: [] });

  const { data: recs } = await supabase.from("honorarios_boletas").select("profile_id, folio").eq("tenant_id", tenantId).eq("month", first);
  const received = new Set((recs || []).filter((r: any) => r.folio).map((r: any) => r.profile_id));
  const { data: profs } = await supabase.from("profiles").select("id, email").in("id", pros.map((p) => p.barberId));
  const emailById = new Map<string, string | null>((profs || []).map((p: any) => [p.id, p.email]));
  const { data: tenant } = await supabase.from("tenants").select("name, logo_url").eq("id", tenantId).maybeSingle();

  const out = { sent: 0, failed: [] as string[], noEmail: [] as string[], alreadyReceived: [] as string[] };
  for (const p of pros) {
    if (received.has(p.barberId)) { out.alreadyReceived.push(p.name); continue; }
    const to = emailById.get(p.barberId);
    if (!to) { out.noEmail.push(p.name); continue; }
    const t = p.tax!;
    const r = await sendHonorariosNotice({
      to, name: p.name.split(" ")[0], businessName: tenant?.name || "tu negocio", businessLogoUrl: tenant?.logo_url || null,
      monthLabel: `${MONTHS[month - 1]} ${year}`, gross: t.documentTotal, rate: t.rate, retention: t.amount, net: t.finalAmount,
    });
    if (r.success) out.sent += 1; else out.failed.push(p.name);
  }
  return NextResponse.json(out);
}
