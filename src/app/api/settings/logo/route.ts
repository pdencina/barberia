import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";

// POST: Upload a business logo, saved on tenants.logo_url.
// Used to show the salon's own branding on the public booking page and on receipt
// emails, instead of the generic re-booking logo everywhere.
// Keep this comfortably under Supabase's default Storage limit (50MB on most plans,
// but the "silent" failures reported here are almost always a much smaller browser/
// phone-camera photo, so we cap well below that to fail fast with a clear message
// instead of a vague network error.
const MAX_LOGO_BYTES = 5 * 1024 * 1024; // 5MB

export async function POST(req: NextRequest) {
  const supabase = createAdminSupabase();

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch (e: any) {
    return NextResponse.json({ error: `No se pudo leer el archivo enviado: ${e.message}` }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  const tenantId = formData.get("tenantId") as string;

  if (!file) {
    return NextResponse.json({ error: "No se recibio ningun archivo" }, { status: 400 });
  }
  if (!tenantId) {
    return NextResponse.json({ error: "tenantId requerido" }, { status: 400 });
  }
  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: `El archivo debe ser una imagen (recibido: ${file.type || "tipo desconocido"})` }, { status: 400 });
  }
  if (file.size > MAX_LOGO_BYTES) {
    return NextResponse.json(
      { error: `La imagen pesa ${(file.size / 1024 / 1024).toFixed(1)}MB, el maximo permitido es 5MB. Comprimela o toma una captura mas liviana.` },
      { status: 400 }
    );
  }

  // Confirm the bucket is reachable before attempting the upload, so a missing/
  // misconfigured bucket produces a clear message instead of a generic upload error.
  const { data: bucketInfo, error: bucketError } = await supabase.storage.getBucket("cut-photos");
  if (bucketError || !bucketInfo) {
    return NextResponse.json(
      { error: "El almacenamiento de imagenes (bucket 'cut-photos') no esta disponible. Avisa al soporte tecnico." },
      { status: 500 }
    );
  }

  const fileExt = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
  const fileName = `logos/${tenantId}.${fileExt}`;

  const arrayBuffer = await file.arrayBuffer();
  const buffer = new Uint8Array(arrayBuffer);

  const { error: uploadError } = await supabase.storage
    .from("cut-photos")
    .upload(fileName, buffer, {
      contentType: file.type,
      upsert: true,
    });

  if (uploadError) {
    console.error("Logo upload failed:", uploadError);
    return NextResponse.json({ error: `No se pudo subir la imagen: ${uploadError.message}` }, { status: 500 });
  }

  const { data: urlData } = supabase.storage
    .from("cut-photos")
    .getPublicUrl(fileName);

  const logoUrl = `${urlData.publicUrl}?t=${Date.now()}`; // cache bust

  const { error: updateError } = await supabase
    .from("tenants")
    .update({ logo_url: logoUrl })
    .eq("id", tenantId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ url: logoUrl });
}

// DELETE: Remove the business logo, reverting to the default re-booking branding.
export async function DELETE(req: NextRequest) {
  const supabase = createAdminSupabase();
  const { searchParams } = new URL(req.url);
  const tenantId = searchParams.get("tenantId");

  if (!tenantId) {
    return NextResponse.json({ error: "tenantId requerido" }, { status: 400 });
  }

  const { data: tenant } = await supabase
    .from("tenants")
    .select("logo_url")
    .eq("id", tenantId)
    .single();

  if (tenant?.logo_url) {
    const path = tenant.logo_url.split("/cut-photos/")[1]?.split("?")[0];
    if (path) {
      await supabase.storage.from("cut-photos").remove([path]);
    }
  }

  await supabase.from("tenants").update({ logo_url: null }).eq("id", tenantId);

  return NextResponse.json({ success: true });
}
