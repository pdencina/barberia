import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";

// Public endpoint to look up a client by email or phone
// Used in the booking page for autocompletion
export async function GET(req: NextRequest) {
  const supabase = createAdminSupabase();
  const { searchParams } = new URL(req.url);
  const email = searchParams.get("email");
  const phone = searchParams.get("phone");

  if (!email && !phone) {
    return NextResponse.json({ found: false });
  }

  let query = supabase.from("clients").select("id, name, email, phone");

  if (email) {
    query = query.eq("email", email);
  } else if (phone) {
    query = query.eq("phone", phone);
  }

  const { data } = await query.single();

  if (data) {
    return NextResponse.json({ found: true, client: data });
  }

  return NextResponse.json({ found: false });
}
