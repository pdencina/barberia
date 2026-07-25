import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const supabase = createAdminSupabase();
  const { searchParams } = new URL(req.url);
  const entityType = searchParams.get("type"); // service, product
  const entityId = searchParams.get("entityId");

  let query = supabase
    .from("price_history")
    .select("*, changed_by_profile:profiles!price_history_changed_by_fkey(name)")
    .order("created_at", { ascending: false })
    .limit(50);

  if (entityType) query = query.eq("entity_type", entityType);
  if (entityId) query = query.eq("entity_id", entityId);

  const { data } = await query;
  return NextResponse.json(data || []);
}
