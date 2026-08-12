import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";

// GET: Services available for a specific barber, with custom prices/duration
export async function GET(req: NextRequest) {
  const supabase = createAdminSupabase();
  const { searchParams } = new URL(req.url);
  const barberId = searchParams.get("barberId");

  if (!barberId) {
    return NextResponse.json({ error: "barberId requerido" }, { status: 400 });
  }

  // Get all active services
  const { data: services } = await supabase
    .from("services")
    .select("id, name, description, price, duration")
    .eq("active", true)
    .order("name");

  // Get custom prices for this barber
  const { data: customPrices } = await supabase
    .from("barber_services")
    .select("service_id, custom_price, custom_duration")
    .eq("barber_id", barberId);

  // Get assigned services (if any)
  const { data: assignments } = await supabase
    .from("barber_service_assignments")
    .select("service_id")
    .eq("barber_id", barberId);

  const assignedIds = (assignments || []).map((a) => a.service_id);
  const hasAssignments = assignedIds.length > 0;

  // Merge: apply custom prices where they exist
  const customMap = new Map((customPrices || []).map((c) => [c.service_id, c]));

  const result = (services || [])
    .filter((s) => {
      // If barber has specific assignments, only show those
      if (hasAssignments && !assignedIds.includes(s.id)) return false;
      return true;
    })
    .map((s) => {
      const custom = customMap.get(s.id);
      return {
        id: s.id,
        name: s.name,
        description: s.description,
        price: custom?.custom_price ? Number(custom.custom_price) : Number(s.price),
        duration: custom?.custom_duration || s.duration,
        hasCustomPrice: !!custom?.custom_price,
      };
    });

  return NextResponse.json(result);
}
