import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";

// PATCH: Change a user's role (requires admin PIN)
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createAdminSupabase();
  const { role, pin } = await req.json();

  // Validate PIN
  if (!pin || pin.length !== 4) {
    return NextResponse.json({ error: "PIN de 4 digitos requerido" }, { status: 400 });
  }

  // Verify admin PIN
  const { data: admin } = await supabase
    .from("profiles")
    .select("id, name")
    .in("role", ["admin", "super_admin"])
    .eq("personal_pin", pin)
    .eq("active", true)
    .single();

  if (!admin) {
    return NextResponse.json({ error: "PIN incorrecto" }, { status: 401 });
  }

  // Validate role
  const validRoles = ["barber", "admin", "super_admin", "receptionist"];
  if (!validRoles.includes(role)) {
    return NextResponse.json({ error: "Rol invalido" }, { status: 400 });
  }

  // Update role
  const { error } = await supabase
    .from("profiles")
    .update({ role })
    .eq("id", params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, message: `Rol actualizado por ${admin.name}` });
}
