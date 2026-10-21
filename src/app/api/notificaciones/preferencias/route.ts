import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, getCurrentUserRoleAndTenant } from "@/lib/supabase/server";
import { NOTIFY_KINDS, type NotifyKind } from "@/lib/notify";

// Preferencias de la persona con la sesión abierta: tipos que silencia, horario de silencio (hora de Chile)
// y modo "sin detalles" en la pantalla bloqueada. Los avisos esenciales no se pueden silenciar.
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

// Profesionales del negocio que se pueden elegir ("de quien quiero recibir avisos").
async function professionalsOf(tenantId: string | null) {
  if (!tenantId) return [] as { id: string; name: string }[];
  const { data } = await createAdminSupabase().from("profiles").select("id, name, role, also_attends_clients")
    .eq("tenant_id", tenantId).eq("active", true).in("role", ["barber", "admin", "receptionist"]).order("name");
  return (data || []).filter((p: any) => p.role === "barber" || p.also_attends_clients).map((p: any) => ({ id: p.id as string, name: p.name as string }));
}

export async function GET() {
  const { userId, role, tenantId } = await getCurrentUserRoleAndTenant();
  if (!userId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const supabase = createAdminSupabase();
  let data: any = null; let migrationMissing = false;
  const full = await supabase.from("notification_preferences").select("muted_kinds, quiet_start, quiet_end, hide_details, pro_filter_mode, pro_filter_ids").eq("user_id", userId).maybeSingle();
  if (!full.error) data = full.data;
  else { migrationMissing = true; data = (await supabase.from("notification_preferences").select("muted_kinds, quiet_start, quiet_end, hide_details").eq("user_id", userId).maybeSingle()).data; }
  // Solo administracion y recepcion reciben avisos de varios profesionales; el resto recibe solo los suyos.
  const canFilter = role === "admin" || role === "super_admin" || role === "receptionist";
  return NextResponse.json({
    mutedKinds: data?.muted_kinds || [], quietStart: data?.quiet_start || "", quietEnd: data?.quiet_end || "", hideDetails: !!data?.hide_details,
    kinds: Object.entries(NOTIFY_KINDS).map(([key, v]) => ({ key, label: v.label, essential: v.essential })),
    canFilter, proFilterMode: data?.pro_filter_mode || "all", proFilterIds: data?.pro_filter_ids || [],
    professionals: canFilter ? await professionalsOf(tenantId) : [], filterMigrationMissing: migrationMissing,
  });
}

export async function PUT(req: NextRequest) {
  const { userId, role, tenantId } = await getCurrentUserRoleAndTenant();
  if (!userId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const b = await req.json().catch(() => ({} as any));
  const muted = (Array.isArray(b.mutedKinds) ? b.mutedKinds : [])
    .filter((k: any) => typeof k === "string" && k in NOTIFY_KINDS && !NOTIFY_KINDS[k as NotifyKind].essential);
  const qs = typeof b.quietStart === "string" && HHMM.test(b.quietStart) ? b.quietStart : null;
  const qe = typeof b.quietEnd === "string" && HHMM.test(b.quietEnd) ? b.quietEnd : null;
  const row: Record<string, any> = { user_id: userId, tenant_id: tenantId, muted_kinds: muted, quiet_start: qs && qe ? qs : null, quiet_end: qs && qe ? qe : null, hide_details: !!b.hideDetails, updated_at: new Date().toISOString() };

  // De que profesionales quiere recibir avisos (solo administracion / recepcion). Los ids deben ser de profesionales de su negocio.
  const canFilter = role === "admin" || role === "super_admin" || role === "receptionist";
  let filter: { pro_filter_mode: string; pro_filter_ids: string[] } | null = null;
  if (canFilter && (b.proFilterMode === "all" || b.proFilterMode === "own" || b.proFilterMode === "selected")) {
    const valid = new Set((await professionalsOf(tenantId)).map((p) => p.id));
    const ids = (Array.isArray(b.proFilterIds) ? b.proFilterIds : []).filter((id: any) => typeof id === "string" && valid.has(id));
    filter = { pro_filter_mode: b.proFilterMode, pro_filter_ids: b.proFilterMode === "selected" ? ids : [] };
  }

  const supabase = createAdminSupabase();
  let { error } = await supabase.from("notification_preferences").upsert(filter ? { ...row, ...filter } : row, { onConflict: "user_id" });
  let warning: string | undefined;
  if (error && filter && /pro_filter/i.test(error.message)) {
    // Falta la migracion 114: se guarda el resto y se avisa.
    warning = "Falta aplicar la migración 114: se guardó lo demás, pero no la elección de profesionales.";
    ({ error } = await supabase.from("notification_preferences").upsert(row, { onConflict: "user_id" }));
  }
  if (error) return NextResponse.json({ error: /does not exist|schema cache/i.test(error.message) ? "Falta aplicar la migración 100 en la base de datos." : error.message }, { status: 500 });
  return NextResponse.json({ success: true, warning });
}
