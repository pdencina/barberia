import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";

// POST: Verify admin PIN for discount authorization
export async function POST(req: NextRequest) {
  const supabase = createAdminSupabase();
  const { pin } = await req.json();

  if (!pin || pin.length !== 4) {
    return NextResponse.json({ valid: false, error: "PIN debe ser de 4 digitos" }, { status: 400 });
  }

  // Check against profiles with role admin or super_admin that have a PIN set
  const { data: admin } = await supabase
    .from("profiles")
    .select("id, name")
    .in("role", ["admin", "super_admin"])
    .eq("personal_pin", pin)
    .eq("active", true)
    .single();

  if (!admin) {
    return NextResponse.json({ valid: false, error: "PIN incorrecto" }, { status: 401 });
  }

  return NextResponse.json({ valid: true, adminName: admin.name });
}
