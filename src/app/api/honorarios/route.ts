import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, getCurrentUserRoleAndTenant } from "@/lib/supabase/server";
import { computeProMonths } from "@/lib/ledger";
import { todayInChile } from "@/lib/utils";

export const dynamic = "force-dynamic";

// Boletas de honorarios (figura con retencion): re-booking no las emite, solo calcula lo esperado y registra lo recibido.
// SEGURIDAD: solo administrador del negocio (o super_admin con ?tenantId=).
async function adminTenant(requested?: string | null) {
  const { userId, role, tenantId } = await getCurrentUserRoleAndTenant();
  if (!userId || (role !== "admin" && role !== "super_admin")) return null;
  const t = role === "super_admin" ? requested || tenantId : tenantId;
  return t && t !== "ALL" ? { tenantId: t, userId } : null;
}

function params(sp: URLSearchParams) {
  const [cy, cm] = todayInChile().split("-").map(Number);
  const year = parseInt(sp.get("year") || String(cy));
  const month = parseInt(sp.get("month") || String(cm));
  return { year, month, first: `${year}-${String(month).padStart(2, "0")}-01` };
}

export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams;
  const auth = await adminTenant(sp.get("tenantId"));
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { year, month, first } = params(sp);
  const supabase = createAdminSupabase();

  const pros = await computeProMonths(supabase, { tenantId: auth.tenantId, mode: "commission", year, month });
  const retained = pros.filter((p) => p.tax && p.tax.kind === "retencion");

  const { data: recs, error } = await supabase.from("honorarios_boletas").select("*").eq("tenant_id", auth.tenantId).eq("month", first);
  const byPro = new Map<string, any>((error ? [] : recs || []).map((r: any) => [r.profile_id, r]));

  const rows = retained.map((p) => {
    const rec = byPro.get(p.barberId) || null;
    const t = p.tax!;
    const received = !!rec?.folio;
    return {
      barberId: p.barberId, name: p.name,
      gross: t.base, rate: t.rate, retention: t.amount, net: t.finalAmount,
      record: rec ? { folio: rec.folio, issuedOn: rec.issued_on, amount: rec.amount, retentionAmount: rec.retention_amount, notes: rec.notes } : null,
      status: !received ? "pendiente" : Number(rec.amount) === t.base ? "recibida" : "diferencia",
    };
  });

  return NextResponse.json({
    year, month, rows, missing_migration: !!error,
    summary: {
      expectedRetention: rows.reduce((a, r) => a + r.retention, 0),
      receivedRetention: rows.reduce((a, r) => a + (r.record?.retentionAmount ?? 0), 0),
      pending: rows.filter((r) => r.status === "pendiente").length,
    },
  });
}

// PUT: registra (o corrige) la boleta de honorarios recibida de un profesional. folio vacio = quitar el registro.
export async function PUT(req: NextRequest) {
  const auth = await adminTenant(new URL(req.url).searchParams.get("tenantId"));
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const year = Number(b.year), month = Number(b.month);
  if (!b.profileId || !(year > 2000) || !(month >= 1 && month <= 12)) return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
  const first = `${year}-${String(month).padStart(2, "0")}-01`;
  const supabase = createAdminSupabase();

  const { data: prof } = await supabase.from("profiles").select("id, tenant_id").eq("id", b.profileId).maybeSingle();
  if (!prof || prof.tenant_id !== auth.tenantId) return NextResponse.json({ error: "Profesional no encontrado" }, { status: 404 });

  const folio = typeof b.folio === "string" ? b.folio.trim() : "";
  if (!folio) {
    const { error } = await supabase.from("honorarios_boletas").delete().eq("profile_id", b.profileId).eq("month", first);
    if (error) return NextResponse.json({ error: "Falta aplicar la migración 119" }, { status: 503 });
    return NextResponse.json({ success: true });
  }
  const amount = Math.round(Number(b.amount));
  if (!(amount > 0)) return NextResponse.json({ error: "El monto de la boleta debe ser mayor a 0" }, { status: 400 });
  if (b.issuedOn && !/^\d{4}-\d{2}-\d{2}$/.test(b.issuedOn)) return NextResponse.json({ error: "Fecha inválida" }, { status: 400 });

  // Lo esperado se toma del servidor (no del navegador).
  const pros = await computeProMonths(supabase, { tenantId: auth.tenantId, mode: "commission", year, month });
  const pm = pros.find((p) => p.barberId === b.profileId);
  if (!pm?.tax || pm.tax.kind !== "retencion") return NextResponse.json({ error: "Este profesional no tiene retención de honorarios activa" }, { status: 400 });

  const { data: me } = await supabase.from("profiles").select("name").eq("id", auth.userId).maybeSingle();
  const { error } = await supabase.from("honorarios_boletas").upsert({
    tenant_id: auth.tenantId, profile_id: b.profileId, month: first,
    expected_gross: pm.tax.base, retention_rate: pm.tax.rate, expected_retention: pm.tax.amount,
    folio, issued_on: b.issuedOn || null, amount, retention_amount: Math.round((amount * pm.tax.rate) / 100),
    notes: typeof b.notes === "string" ? b.notes.trim() || null : null,
    registered_by: auth.userId, registered_by_name: me?.name || null, updated_at: new Date().toISOString(),
  }, { onConflict: "profile_id,month" });
  if (error) return NextResponse.json({ error: "Falta aplicar la migración 119" }, { status: 503 });
  return NextResponse.json({ success: true });
}
