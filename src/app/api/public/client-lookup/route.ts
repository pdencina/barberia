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

  // Take the first match. Using .single() here silently FAILED whenever more than one
  // client shared the email — which is exactly the duplicate situation this feature is
  // supposed to prevent. It returned found:false, the booking created yet another
  // duplicate, and the loop kept growing. maybeSingle + limit(1) returns the existing
  // one instead.
  const { data } = await query.order("created_at", { ascending: true }).limit(1).maybeSingle();

  if (data) {
    return NextResponse.json({ found: true, client: data });
  }

  return NextResponse.json({ found: false });
}
