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
    .select("service_id, custom_price, custom_duration, active")
    .eq("barber_id", barberId);

  // Merge: apply custom prices where they exist
  const customMap = new Map((customPrices || []).map((c) => [c.service_id, c]));

  const result = (services || [])
    .map((s) => {
      const custom = customMap.get(s.id);
      // If custom entry exists and is inactive, hide this service for this barber
      if (custom && !custom.active) return null;
      return {
        id: s.id,
        name: s.name,
        description: s.description,
        price: custom?.custom_price ? Number(custom.custom_price) : Number(s.price),
        duration: custom?.custom_duration || s.duration,
        hasCustomPrice: !!custom?.custom_price,
      };
    })
    .filter(Boolean);

  return NextResponse.json(result);
}
