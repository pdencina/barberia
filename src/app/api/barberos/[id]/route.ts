import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";

// GET: Get single professional profile
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", params.id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// PATCH: Update professional profile (mode, rates, etc.)
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createAdminSupabase();
  const body = await req.json();

  // Only allow updating specific fields
  const allowedFields = [
    "name", "email", "phone", "active", "work_mode",
    "commission_rate", "rental_daily_rate", "rental_min_days",
    "rental_max_days", "rental_deductions", "rental_notes",
    "personal_pin", "avatar_url", "bio", "specialties",
    "intro_video_url", "years_experience", "slot_duration",
    "also_attends_clients", "instagram",
  ];

  const update: Record<string, any> = {};
  for (const key of allowedFields) {
    if (body[key] !== undefined) update[key] = body[key];
  }

  const { data, error } = await supabase
    .from("profiles")
    .update(update)
    .eq("id", params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// DELETE: Permanently purge a professional (auth account + profile row), freeing up
// their email to be reused. This is NOT the same as "Desactivar" (active=false) — that
// just hides them. Purging is only allowed when the professional has no real business
// history (appointments, sales, commissions, rental records, reviews), so we never
// silently destroy revenue/history data. If they have history, they must stay
// deactivated instead of purged.
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createAdminSupabase();
  const barberId = params.id;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, name, email, active")
    .eq("id", barberId)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "Profesional no encontrado" }, { status: 404 });
  }

  if (profile.active) {
    return NextResponse.json(
      { error: "Primero debes desactivar al profesional antes de eliminarlo definitivamente." },
      { status: 400 }
    );
  }

  // Check for real business history across every table that references this barber.
  const checks = await Promise.all([
    supabase.from("appointments").select("id", { count: "exact", head: true }).eq("barber_id", barberId),
    supabase.from("transactions").select("id", { count: "exact", head: true }).eq("barber_id", barberId),
    supabase.from("commissions").select("id", { count: "exact", head: true }).eq("barber_id", barberId),
    supabase.from("rental_records").select("id", { count: "exact", head: true }).eq("barber_id", barberId),
    supabase.from("reviews").select("id", { count: "exact", head: true }).eq("barber_id", barberId),
  ]);

  const totalHistory = checks.reduce((sum, c) => sum + (c.count || 0), 0);
  if (totalHistory > 0) {
    return NextResponse.json(
      {
        error: `${profile.name} tiene historial real (citas, ventas o comisiones) y no se puede eliminar definitivamente sin perder esos datos. Dejalo desactivado en su lugar.`,
      },
      { status: 409 }
    );
  }

  // Safe to purge: remove the auth account (frees the email) and the profile row.
  // Tables like barber_blocks, gallery, barber_service_assignments and barber_schedule
  // cascade-delete automatically (ON DELETE CASCADE) when the profile row is removed.
  const { error: authError } = await supabase.auth.admin.deleteUser(barberId);
  if (authError && !authError.message.toLowerCase().includes("not found")) {
    return NextResponse.json({ error: `No se pudo eliminar la cuenta: ${authError.message}` }, { status: 500 });
  }

  const { error: profileError } = await supabase.from("profiles").delete().eq("id", barberId);
  if (profileError) {
    return NextResponse.json({ error: `No se pudo eliminar el perfil: ${profileError.message}` }, { status: 500 });
  }

  return NextResponse.json({ success: true, purgedEmail: profile.email });
}
