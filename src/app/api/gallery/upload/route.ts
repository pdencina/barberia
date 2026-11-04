import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, authorizeBarberManagement, getCurrentUserRoleAndTenant } from "@/lib/supabase/server";

// Upload image to Supabase Storage and return URL
export async function POST(req: NextRequest) {
  const supabase = createAdminSupabase();
  // SEGURIDAD: antes no pedia sesion: cualquiera podia subir archivos al almacenamiento a nombre de cualquier profesional.
  if (!(await getCurrentUserRoleAndTenant()).userId) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File;
  const barberId = formData.get("barberId") as string;
  if (typeof barberId !== "string" || !(await authorizeBarberManagement(barberId, { allowSelf: true })).ok) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  if (!file || !barberId) {
    return NextResponse.json({ error: "Archivo y profesional requeridos" }, { status: 400 });
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
    console.error("Gallery upload error:", error);
    if (error.message.includes("not found") || error.message.includes("Bucket")) {
      return NextResponse.json({ error: "El bucket de galeria no existe. Crea un bucket 'gallery' en Supabase Storage." }, { status: 500 });
    }
    return NextResponse.json({ error: `Error subiendo: ${error.message}` }, { status: 500 });
  }

  // Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from("gallery")
    .getPublicUrl(data.path);

  return NextResponse.json({ url: publicUrl });
}
