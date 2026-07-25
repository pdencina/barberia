import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createAdminSupabase();
  const body = await req.json();

  const { data, error } = await supabase
    .from("services")
    .update(body)
    .eq("id", params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createAdminSupabase();

  // Soft delete - just deactivate
  const { error } = await supabase
    .from("services")
    .update({ active: false })
    .eq("id", params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
