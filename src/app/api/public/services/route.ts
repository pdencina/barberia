import { NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";

export async function GET() {
  const supabase = createAdminSupabase();
  const { data } = await supabase
    .from("services")
    .select("id, name, description, price, duration")
    .eq("active", true)
    .order("price", { ascending: true });

  return NextResponse.json(data || []);
}
