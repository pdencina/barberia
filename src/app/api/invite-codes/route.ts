import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";

// GET: List invite codes for a tenant
export async function GET(req: NextRequest) {
  const supabase = createAdminSupabase();
  const { searchParams } = new URL(req.url);
  const tenantId = searchParams.get("tenantId");

  if (!tenantId) return NextResponse.json([]);

  const { data } = await supabase
    .from("invite_codes")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("active", true)
    .order("created_at", { ascending: false });

  return NextResponse.json(data || []);
}

// POST: Generate a new invite code
export async function POST(req: NextRequest) {
  const supabase = createAdminSupabase();
  const { tenantId, userId } = await req.json();

  if (!tenantId) {
    return NextResponse.json({ error: "tenantId required" }, { status: 400 });
  }

  // Generate readable code (6 chars uppercase)
  const code = Math.random().toString(36).slice(2, 8).toUpperCase();

  const { data, error } = await supabase
    .from("invite_codes")
    .insert({
      tenant_id: tenantId,
      code,
      uses_remaining: 10,
      created_by: userId || null,
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
    })
    .select()
    .single();

  if (error) {
    // If table doesn't exist yet, provide helpful message
    if (error.message.includes("relation") || error.code === "42P01") {
      return NextResponse.json({ error: "Tabla invite_codes no existe. Ejecuta la migracion 042." }, { status: 500 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}

// DELETE: Deactivate an invite code
export async function DELETE(req: NextRequest) {
  const supabase = createAdminSupabase();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  await supabase.from("invite_codes").update({ active: false }).eq("id", id);
  return NextResponse.json({ success: true });
}
