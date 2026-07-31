import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = createAdminSupabase();
  const { pin } = await req.json();

  if (!pin) return NextResponse.json({ valid: false, error: "PIN requerido" });

  const { data: barber } = await supabase
    .from("profiles")
    .select("id, name")
    .eq("personal_pin", pin)
    .eq("role", "barber")
    .eq("active", true)
    .single();

  if (!barber) {
    return NextResponse.json({ valid: false, error: "Codigo incorrecto" });
  }

  return NextResponse.json({ valid: true, barber });
}
