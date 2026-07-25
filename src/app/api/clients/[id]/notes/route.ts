import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createAdminSupabase();

  const { data } = await supabase
    .from("client_notes")
    .select("*, created_by_profile:profiles!client_notes_created_by_fkey(name)")
    .eq("client_id", params.id)
    .order("pinned", { ascending: false })
    .order("created_at", { ascending: false });

  return NextResponse.json(data || []);
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createAdminSupabase();
  const body = await req.json();
  const { note, pinned } = body;

  if (!note?.trim()) {
    return NextResponse.json({ error: "Nota requerida" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("client_notes")
    .insert({
      client_id: params.id,
      note: note.trim(),
      pinned: pinned || false,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const supabase = createAdminSupabase();
  const { searchParams } = new URL(req.url);
  const noteId = searchParams.get("noteId");

  if (!noteId) return NextResponse.json({ error: "noteId requerido" }, { status: 400 });

  await supabase.from("client_notes").delete().eq("id", noteId);
  return NextResponse.json({ success: true });
}
