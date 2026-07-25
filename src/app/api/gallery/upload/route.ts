import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";

// Upload image to Supabase Storage and return URL
export async function POST(req: NextRequest) {
  const supabase = createAdminSupabase();

  const formData = await req.formData();
  const file = formData.get("file") as File;
  const barberId = formData.get("barberId") as string;

  if (!file || !barberId) {
    return NextResponse.json({ error: "Archivo y barbero requeridos" }, { status: 400 });
  }

  // Generate unique filename
  const ext = file.name.split(".").pop() || "jpg";
  const filename = `${barberId}/${Date.now()}.${ext}`;

  // Upload to Supabase Storage
  const { data, error } = await supabase.storage
    .from("gallery")
    .upload(filename, file, {
      contentType: file.type,
      upsert: false,
    });

  if (error) {
    return NextResponse.json({ error: `Upload failed: ${error.message}` }, { status: 500 });
  }

  // Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from("gallery")
    .getPublicUrl(data.path);

  return NextResponse.json({ url: publicUrl });
}
