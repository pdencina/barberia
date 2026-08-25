import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const { email } = await req.json();

  if (!email) {
    return NextResponse.json({ error: "Email requerido" }, { status: 400 });
  }

  const supabase = createAdminSupabase();

  // Check if user exists (case-insensitive)
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .ilike("email", email)
    .single();

  // Always return success (don't reveal if email exists)
  if (!profile) {
    return NextResponse.json({ success: true });
  }

  // Use Supabase Auth to send reset email
  const { createClient } = await import("@supabase/supabase-js");
  const authClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  await authClient.auth.resetPasswordForEmail(email, {
    redirectTo: "https://re-booking.cl/reset-password",
  });

  return NextResponse.json({ success: true });
}
