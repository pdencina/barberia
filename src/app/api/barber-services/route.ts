import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";

// GET: All custom prices per barber
export async function GET(req: NextRequest) {
  const supabase = createAdminSupabase();
  const { searchParams } = new URL(req.url);
  const barberId = searchParams.get("barberId");

  if (!barberId) return NextResponse.json([]);

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
