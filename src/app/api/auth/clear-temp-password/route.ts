import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";

// POST: Clear temp password flag after admin changes their password
export async function POST(req: NextRequest) {
  const supabase = createAdminSupabase();
  const { email } = await req.json();

  if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });

  // Clear the flag and temp password
  const { error } = await supabase
    .from("tenants")
    .update({
      must_change_password: false,
      temp_password: null,
    })
    .eq("admin_email", email);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
