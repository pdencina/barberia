import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";

// GET: List terminals for a tenant
export async function GET(req: NextRequest) {
  const supabase = createAdminSupabase();
  const { searchParams } = new URL(req.url);
  const tenantId = searchParams.get("tenantId");

  if (!tenantId) return NextResponse.json([]);

  const { data } = await supabase
    .from("mp_terminals")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("active", true)
    .order("created_at");

  return NextResponse.json(data || []);
}

// POST: Add a terminal
export async function POST(req: NextRequest) {
  const supabase = createAdminSupabase();
  const { tenantId, name, device_id, terminal_type, access_token } = await req.json();

  if (!tenantId || !name || !device_id) {
    return NextResponse.json({ error: "tenantId, name y device_id son obligatorios" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("mp_terminals")
    .insert({
      tenant_id: tenantId,
      name,
      device_id,
      terminal_type: terminal_type || "all",
      access_token: access_token || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// PATCH: Update a terminal
export async function PATCH(req: NextRequest) {
  const supabase = createAdminSupabase();
  const { id, name, device_id, terminal_type, access_token, active } = await req.json();

  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const update: any = {};
  if (name !== undefined) update.name = name;
  if (device_id !== undefined) update.device_id = device_id;
  if (terminal_type !== undefined) update.terminal_type = terminal_type;
  if (access_token !== undefined) update.access_token = access_token || null;
  if (active !== undefined) update.active = active;

  const { data, error } = await supabase
    .from("mp_terminals")
    .update(update)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// DELETE: Remove a terminal
export async function DELETE(req: NextRequest) {
  const supabase = createAdminSupabase();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  await supabase.from("mp_terminals").update({ active: false }).eq("id", id);
  return NextResponse.json({ success: true });
}
