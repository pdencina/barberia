import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase/server";

export async function GET() {
  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, name, email, phone")
    .eq("role", "barber")
    .eq("active", true)
    .order("name");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const adminSupabase = createAdminSupabase();
  const body = await req.json();
  const { name, email, phone, password } = body;

  // Create user in Supabase Auth using admin client
  const { data: authData, error: authError } = await adminSupabase.auth.admin.createUser({
    email,
    password: password || "123456",
    email_confirm: true,
    user_metadata: { name, role: "barber" },
  });

  if (authError) return NextResponse.json({ error: authError.message }, { status: 500 });

  // Update phone in profile
  if (phone) {
    await adminSupabase
      .from("profiles")
      .update({ phone })
      .eq("id", authData.user.id);
  }

  return NextResponse.json(
    { id: authData.user.id, name, email },
    { status: 201 }
  );
}
