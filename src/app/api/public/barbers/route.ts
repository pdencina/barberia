import { NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";

export async function GET() {
  const supabase = createAdminSupabase();
  const { data } = await supabase
    .from("profiles")
    .select("id, name, avatar_url")
    .eq("role", "barber")
    .eq("active", true)
    .order("name");

  return NextResponse.json(data || []);
}
