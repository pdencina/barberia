import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";
import { estadoReservaEnPago } from "@/lib/booking-intent";
import { HOLD_SEGUNDOS } from "@/lib/deposit-hold";

export const dynamic = "force-dynamic";

// La pagina de reservas pregunta aqui si el abono ya se pagó (público a propósito: la referencia es un UUID imposible de adivinar y
// solo devuelve el estado y el id de la cita, ningún dato personal).
export async function GET(req: NextRequest) {
  const ref = new URL(req.url).searchParams.get("ref") || "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ref)) return NextResponse.json({ error: "Referencia no válida" }, { status: 400 });
  const { data } = await createAdminSupabase().from("booking_intents").select("data, created_at").eq("ref", ref).maybeSingle();
  if (!data) return NextResponse.json({ estado: "vencido" });
  return NextResponse.json(estadoReservaEnPago(data.data, data.created_at, Date.now(), HOLD_SEGUNDOS));
}
