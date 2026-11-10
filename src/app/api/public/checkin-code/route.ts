import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";

// GET ?id=<appointmentId>: código corto de llegada de una cita (para mostrarlo en la pantalla de «Cita confirmada»).
// El id de la cita (UUID) es el mismo secreto que ya viaja en el correo y en el enlace de cancelar: sin él no se puede pedir.
export async function GET(req: NextRequest) {
  const id = new URL(req.url).searchParams.get("id") || "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return NextResponse.json({ code: null });
  const { data } = await createAdminSupabase().from("appointments").select("checkin_code").eq("id", id).maybeSingle();
  return NextResponse.json({ code: (data as any)?.checkin_code || null }, { headers: { "Cache-Control": "no-store" } });
}
