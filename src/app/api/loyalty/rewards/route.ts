import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";

// POST: Create a reward
export async function POST(req: NextRequest) {
  const supabase = createAdminSupabase();
  const { name, points_required, discount_value, description } = await req.json();

  const { data, error } = await supabase
    .from("loyalty_rewards")
    .insert({
      name,
      points_required: points_required || 100,
      discount_value: discount_value || 0,
      description: description || name,
      active: true,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// DELETE: Deactivate a reward
export async function DELETE(req: NextRequest) {
  const supabase = createAdminSupabase();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  await supabase.from("loyalty_rewards").update({ active: false }).eq("id", id);
  return NextResponse.json({ success: true });
}
