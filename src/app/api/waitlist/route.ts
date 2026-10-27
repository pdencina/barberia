import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, resolveTenantForRequest } from "@/lib/supabase/server";
import { todayInChile } from "@/lib/utils";
import { authorizeWaitlistEntry } from "@/lib/waitlist-access";

// GET: Admin view of waitlist
export async function GET(req: NextRequest) {
  const supabase = createAdminSupabase();
  const { searchParams } = new URL(req.url);
  // SEGURIDAD: antes no pedia sesion ni filtraba por negocio y devolvia la lista de espera de todos los negocios.
  const { tenantId } = await resolveTenantForRequest(searchParams.get("tenantId"));
  if (!tenantId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const status = searchParams.get("status") || "waiting";

  const today = todayInChile();

  let query = supabase
    .from("waitlist")
    .select(`
      *,
      service:services(name),
      barber:profiles(name)
    `)
    .gte("preferred_date", today)
    .order("preferred_date", { ascending: true });

  if (status !== "all") {
    query = query.eq("status", status);
  }

  const { data } = await query;
  let rows: any[] = data || [];

  // La lista de espera no guarda el negocio: se acota por los servicios y profesionales que SI son de este negocio.
  // (Super admin sin negocio elegido, "ALL", ve todo como siempre.)
  if (tenantId !== "ALL") {
    const [{ data: svc }, { data: pros }] = await Promise.all([
      supabase.from("services").select("id").eq("tenant_id", tenantId),
      supabase.from("profiles").select("id").eq("tenant_id", tenantId),
    ]);
    const svcIds = new Set((svc || []).map((r: any) => r.id));
    const proIds = new Set((pros || []).map((r: any) => r.id));
    rows = rows.filter((r) => (r.service_id && svcIds.has(r.service_id)) || (r.barber_id && proIds.has(r.barber_id)));
  }
  return NextResponse.json(rows);
}

// PATCH: Update waitlist entry status
export async function PATCH(req: NextRequest) {
  const supabase = createAdminSupabase();
  const body = await req.json();
  const { id, status } = body;
  const access = await authorizeWaitlistEntry(id);
  if (!access.ok) return access.response;

  const { error } = await supabase
    .from("waitlist")
    .update({
      status,
      notified_at: status === "notified" ? new Date().toISOString() : undefined,
    })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
