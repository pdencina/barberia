import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, canAccessBarber, authorizeBarberManagement } from "@/lib/supabase/server";

// GET: All custom prices per barber
export async function GET(req: NextRequest) {
  const supabase = createAdminSupabase();
  const { searchParams } = new URL(req.url);
  const barberId = searchParams.get("barberId");

  if (!barberId) return NextResponse.json([]);
  // SEGURIDAD: antes no pedia sesion y entregaba datos de cualquier profesional con solo su id.
  if (!(await canAccessBarber(barberId))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const { data } = await supabase
    .from("barber_services")
    .select("*, service:services(name, price, duration)")
    .eq("barber_id", barberId);

  return NextResponse.json(data || []);
}

// POST: Set custom price for a barber+service
export async function POST(req: NextRequest) {
  const supabase = createAdminSupabase();
  const body = await req.json();
  const { barberId, serviceId, customPrice, customDuration } = body;
  // SEGURIDAD: antes no pedia sesion: cualquiera podia cambiar los precios de un profesional. Solo el propio profesional o la gestion de su negocio.
  if (typeof barberId !== "string" || !(await authorizeBarberManagement(barberId, { allowSelf: true })).ok) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const { data, error } = await supabase
    .from("barber_services")
    .upsert({
      barber_id: barberId,
      service_id: serviceId,
      custom_price: customPrice || null,
      custom_duration: customDuration || null,
    }, { onConflict: "barber_id,service_id" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
