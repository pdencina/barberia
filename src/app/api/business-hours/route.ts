import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";
import { getTenantFromRequest } from "@/lib/tenant-filter";

const dayNames = ["Domingo", "Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado"];

// Avoid build-time prerendering: this reads from the DB and must not be baked/stale.
export const dynamic = "force-dynamic";

const defaultHours = () =>
  dayNames.map((_, i) => ({
    day_of_week: i,
    open_time: "10:00",
    close_time: "21:00",
    is_closed: i === 0, // Sunday closed
  }));

// GET: business hours for the caller's business
export async function GET(req: NextRequest) {
  const supabase = createAdminSupabase();
  const tenantId = await getTenantFromRequest(req);

  let query = supabase.from("business_hours").select("*").order("day_of_week");
  // Scope to the caller's business so salons don't see each other's hours.
  if (tenantId && tenantId !== "ALL") query = query.eq("tenant_id", tenantId);

  const { data } = await query;

  // If no data exists for this business, return sensible defaults
  if (!data || data.length === 0) {
    return NextResponse.json(defaultHours());
  }

  return NextResponse.json(data);
}

// PATCH: Update business hours for a specific day (per business)
export async function PATCH(req: NextRequest) {
  const supabase = createAdminSupabase();
  const body = await req.json();
  const { dayOfWeek, openTime, closeTime, isClosed } = body;

  if (dayOfWeek === undefined || dayOfWeek < 0 || dayOfWeek > 6) {
    return NextResponse.json({ error: "dayOfWeek invalido (0-6)" }, { status: 400 });
  }

  // Resolve the business: body param first, then the session.
  let tenantId: string | null = body.tenantId || null;
  if (!tenantId) {
    const resolved = await getTenantFromRequest(req);
    tenantId = resolved && resolved !== "ALL" ? resolved : null;
  }
  if (!tenantId) {
    return NextResponse.json(
      { error: "No se pudo determinar el negocio para guardar los horarios." },
      { status: 400 }
    );
  }

  // The unique index is (tenant_id, day_of_week) — see migration 050. Using only
  // day_of_week here would fail (no matching constraint) or clobber another salon's row.
  const { error } = await supabase
    .from("business_hours")
    .upsert({
      tenant_id: tenantId,
      day_of_week: dayOfWeek,
      open_time: openTime || "10:00",
      close_time: closeTime || "21:00",
      is_closed: isClosed || false,
    }, { onConflict: "tenant_id,day_of_week" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
