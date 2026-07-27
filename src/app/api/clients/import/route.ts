import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = createAdminSupabase();
  const body = await req.json();
  const { clients } = body; // array of { name, email, phone, notes }

  if (!clients || !Array.isArray(clients) || clients.length === 0) {
    return NextResponse.json({ error: "No hay clientes para importar" }, { status: 400 });
  }

  let imported = 0;
  let skipped = 0;

  for (const client of clients) {
    if (!client.name || !client.name.trim()) {
      skipped++;
      continue;
    }

    // Check if already exists by email
    if (client.email) {
      const { data: existing } = await supabase
        .from("clients")
        .select("id")
        .eq("email", client.email.trim())
        .single();

      if (existing) {
        skipped++;
        continue;
      }
    }

    await supabase.from("clients").insert({
      name: client.name.trim(),
      email: client.email?.trim() || null,
      phone: client.phone?.trim() || null,
      notes: client.notes?.trim() || null,
    });
    imported++;
  }

  return NextResponse.json({ success: true, imported, skipped, total: clients.length });
}
