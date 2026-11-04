import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, canAccessBarber, authorizeBarberManagement } from "@/lib/supabase/server";

// GET: Get assigned services for a barber
export async function GET(req: NextRequest) {
  const supabase = createAdminSupabase();
  const { searchParams } = new URL(req.url);
  const barberId = searchParams.get("barberId");

  if (!barberId) return NextResponse.json([]);
  // SEGURIDAD: antes no pedia sesion y entregaba datos de cualquier profesional con solo su id.
  if (!(await canAccessBarber(barberId))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const { data } = await supabase
    .from("barber_service_assignments")
    .select("service_id")
    .eq("barber_id", barberId);

  // Return array of service IDs
  return NextResponse.json((data || []).map((d) => d.service_id));
}

// POST: Save assigned services for a barber (replaces all)
export async function POST(req: NextRequest) {
  const supabase = createAdminSupabase();
  const { barberId, serviceIds } = await req.json();

  if (!barberId) {
    return NextResponse.json({ error: "barberId required" }, { status: 400 });
  }
  // SEGURIDAD: antes no pedia sesion: cualquiera podia cambiar que servicios hace un profesional. Solo el propio profesional o la gestion de su negocio.
  if (typeof barberId !== "string" || !(await authorizeBarberManagement(barberId, { allowSelf: true })).ok) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  // Delete all existing assignments
  await supabase.from("barber_service_assignments").delete().eq("barber_id", barberId);

  // Insert new assignments (if empty array = offers all services)
  if (serviceIds && serviceIds.length > 0) {
    const inserts = serviceIds.map((serviceId: string) => ({
      barber_id: barberId,
      service_id: serviceId,
    }));
    await supabase.from("barber_service_assignments").insert(inserts);
  }

  return NextResponse.json({ success: true, count: serviceIds?.length || 0 });
}
