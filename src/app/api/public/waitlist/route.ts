import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";

// POST: Client joins waitlist
export async function POST(req: NextRequest) {
  const supabase = createAdminSupabase();
  const body = await req.json();
  const { clientName, clientEmail, clientPhone, serviceId, barberId, preferredDate } = body;

  if (!clientName || !preferredDate) {
    return NextResponse.json({ error: "Nombre y fecha requeridos" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("waitlist")
    .insert({
      client_name: clientName,
      client_email: clientEmail || null,
      client_phone: clientPhone || null,
      service_id: serviceId || null,
      barber_id: barberId || null,
      preferred_date: preferredDate,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, id: data.id });
}
