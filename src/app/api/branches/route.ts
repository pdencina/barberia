import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";

export async function GET() {
  const supabase = createAdminSupabase();
  const { data } = await supabase
    .from("branches")
    .select("*")
    .eq("active", true)
    .order("name");

  return NextResponse.json(data || []);
}

export async function POST(req: NextRequest) {
  const supabase = createAdminSupabase();
  const body = await req.json();
  const { name, slug, address, phone, email, open_time, close_time } = body;

  const { data, error } = await supabase
    .from("branches")
    .insert({
      name,
      slug: slug || name.toLowerCase().replace(/\s+/g, "-"),
      address,
      phone,
      email,
      open_time: open_time || "10:00",
      close_time: close_time || "21:00",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
