import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET() {
  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from("services")
    .select("*")
    .eq("active", true)
    .order("name");

  if (error) return NextResponse.json([]);
  return NextResponse.json(data || []);
}

export async function POST(req: NextRequest) {
  const supabase = createServerSupabase();
  const body = await req.json();
  const { name, description, price, duration } = body;

  const { data, error } = await supabase
    .from("services")
    .insert({ name, description, price, duration })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
