import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";

// GET: List audit log entries
export async function GET(req: NextRequest) {
  const supabase = createAdminSupabase();
  const { searchParams } = new URL(req.url);
  const limit = parseInt(searchParams.get("limit") || "50");
  const action = searchParams.get("action");

  let query = supabase
    .from("audit_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (action) query = query.eq("action", action);

  const { data } = await query;
  return NextResponse.json(data || []);
}

// POST: Log an action
export async function POST(req: NextRequest) {
  const supabase = createAdminSupabase();
  const body = await req.json();
  const { action, entityType, entityId, description, metadata, userId, userName, reversible } = body;

  const { data, error } = await supabase
    .from("audit_log")
    .insert({
      action,
      entity_type: entityType || null,
      entity_id: entityId || null,
      description,
      metadata: metadata || {},
      user_id: userId || null,
      user_name: userName || null,
      reversible: reversible || false,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// PATCH: Reverse an action (super admin only, with PIN)
export async function PATCH(req: NextRequest) {
  const supabase = createAdminSupabase();
  const { auditId, reversedBy } = await req.json();

  if (!auditId) return NextResponse.json({ error: "auditId required" }, { status: 400 });

  // Mark as reversed
  const { error } = await supabase
    .from("audit_log")
    .update({
      reversed: true,
      reversed_at: new Date().toISOString(),
      reversed_by: reversedBy || null,
    })
    .eq("id", auditId)
    .eq("reversible", true);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
