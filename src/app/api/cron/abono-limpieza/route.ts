import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";
import { verifyCron } from "@/lib/cron-auth";
import { limpiarHoldsVencidos } from "@/lib/deposit-hold";

// Vercel Cron: borra los bloqueos de horario de abonos que no se pagaron a tiempo (respaldo; ademas se limpian al consultar la disponibilidad).
export async function GET(req: NextRequest) {
  const denied = verifyCron(req);
  if (denied) return denied;
  await limpiarHoldsVencidos(createAdminSupabase());
  return NextResponse.json({ ok: true });
}
