import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";

// POST: Update sort order of services
export async function POST(req: NextRequest) {
  const supabase = createAdminSupabase();
  const body = await req.json();
  const { order } = body; // array of { id, sort_order }

  for (const item of order) {
    await supabase
      .from("services")
      .update({ sort_order: item.sort_order })
      .eq("id", item.id);
  }

  return NextResponse.json({ success: true });
}
